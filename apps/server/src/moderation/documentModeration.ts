import { type DocumentId } from "@automerge/automerge-repo";
import { and, eq, lte } from "drizzle-orm";

import {
  adapter,
  documentLifetime,
  repo,
  repoStorage,
  webSocketServer,
} from "../automergeRepo/automergeRepo.js";
import { snapshotCache } from "../automergeRepo/snapshotCache.js";
import { getSocketAuthContext } from "../automergeRepo/socketAuthContext.js";
import { db } from "../db/client.js";
import {
  documentInvitations,
  documentModeration,
  documents,
  documentThumbnails,
  usersOnDocuments,
} from "../db/schema.js";
import { buildDocumentThumbnailStorageKey } from "../db/thumbnailStorage.js";
import {
  getDocumentThumbnailStore,
  isDocumentThumbnailStorageConfigured,
} from "../storage/documentThumbnailStore.js";
import { pendingThumbnailKeys } from "../storage/publishDocumentThumbnail.js";

// Legacy direct PUTs cannot be cancelled. Keep their cleanup pending rather than
// claiming an expiry bounds completion of a request already in flight.
const legacyRetryMs = 60 * 60_000;
const running = new Map<string, Promise<void>>();

export async function takeDownDocument(input: {
  documentId: string;
  administratorId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason || reason.length > 1000)
    throw new Error("A reason of 1–1000 characters is required");
  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(documentModeration)
      .where(eq(documentModeration.documentId, input.documentId))
      .get();
    if (existing) return;
    const document = tx
      .select()
      .from(documents)
      .where(eq(documents.id, input.documentId))
      .get();
    if (!document) throw new Error("Drawing not found");
    const thumbnail = tx
      .select()
      .from(documentThumbnails)
      .where(eq(documentThumbnails.documentId, input.documentId))
      .get();
    const now = new Date();
    tx.insert(documentModeration)
      .values({
        documentId: input.documentId,
        administratorId: input.administratorId,
        reason,
        thumbnailStorageKey:
          pendingThumbnailKeys.get(input.documentId)?.key ??
          (thumbnail?.storageKey.endsWith("/thumbnail.png")
            ? null
            : thumbnail?.storageKey) ??
          (isDocumentThumbnailStorageConfigured()
            ? buildDocumentThumbnailStorageKey(input.documentId)
            : null),
        legacyThumbnailStorageKey:
          thumbnail?.legacyStorageKey ??
          (thumbnail?.storageKey.endsWith("/thumbnail.png")
            ? thumbnail.storageKey
            : null),
        takenDownAt: now,
      })
      .run();
    tx.update(documentInvitations)
      .set({ revokedAt: now, tag: null, lastUsedAt: null })
      .where(eq(documentInvitations.documentId, input.documentId))
      .run();
    tx.update(documents)
      .set({ name: "Unavailable drawing", deletedAt: now })
      .where(eq(documents.id, input.documentId))
      .run();
    tx.delete(usersOnDocuments)
      .where(eq(usersOnDocuments.documentId, input.documentId))
      .run();
  });
  disconnectDocument(input.documentId);
  await retryDocumentCleanup(input.documentId);
  return db
    .select()
    .from(documentModeration)
    .where(eq(documentModeration.documentId, input.documentId))
    .get()!;
}

function disconnectDocument(id: string) {
  adapter.disconnectDocument(id);
  // Include authenticated token sockets that have not yet sent a sync message.
  for (const socket of webSocketServer.clients) {
    const context = getSocketAuthContext(socket);
    if (context?.kind === "token" && context.documentId === id)
      socket.close(4004, `Drawing unavailable:${id}`);
  }
}

export async function retryDocumentCleanup(id: string): Promise<void> {
  const existing = running.get(id);
  if (existing) return existing;
  const operation = cleanDocument(id).finally(() => running.delete(id));
  running.set(id, operation);
  return operation;
}

async function cleanDocument(id: string) {
  const row = db
    .select()
    .from(documentModeration)
    .where(eq(documentModeration.documentId, id))
    .get();
  if (!row || row.cleanupState === "complete") return;
  const attempt = row.cleanupAttempts + 1;
  db.update(documentModeration)
    .set({ cleanupAttempts: attempt, lastAttemptAt: new Date() })
    .where(eq(documentModeration.documentId, id))
    .run();
  try {
    await withCleanupDeadline(async () => {
      disconnectDocument(id);
      const docId = id as DocumentId;
      await documentLifetime.waitForOperations(docId);
      // No new operations/writes can pass the durable block.
      if (repo.handles[docId]) await repo.removeFromCache(docId);
      snapshotCache.remove(id);
      await repoStorage.removeRange([id]);
      if (row.thumbnailStorageKey)
        await getDocumentThumbnailStore().deleteObject(row.thumbnailStorageKey);
      if (row.legacyThumbnailStorageKey)
        await getDocumentThumbnailStore().deleteObject(
          row.legacyThumbnailStorageKey,
        );
    });
    db.delete(documentThumbnails)
      .where(eq(documentThumbnails.documentId, id))
      .run();
    const complete = !row.legacyThumbnailStorageKey;
    db.update(documentModeration)
      .set({
        cleanupState: complete ? "complete" : "pending",
        completedAt: complete ? new Date() : null,
        nextRetryAt: new Date(Date.now() + legacyRetryMs),
        lastError: complete ? null : "Legacy upload cleanup pending.",
        thumbnailStorageKey: null,
      })
      .where(eq(documentModeration.documentId, id))
      .run();
  } catch {
    // Never persist provider responses: they can contain secrets or user content.
    db.update(documentModeration)
      .set({
        lastError: "Storage cleanup failed. Retry is scheduled.",
        nextRetryAt: new Date(
          Date.now() + Math.min(300_000, 1000 * 2 ** Math.min(attempt, 8)),
        ),
      })
      .where(eq(documentModeration.documentId, id))
      .run();
  }
}

export async function processPendingDocumentCleanup(): Promise<void> {
  const pending = db
    .select({ id: documentModeration.documentId })
    .from(documentModeration)
    .where(
      and(
        eq(documentModeration.cleanupState, "pending"),
        lte(documentModeration.nextRetryAt, new Date()),
      ),
    )
    .limit(10)
    .all();
  for (const { id } of pending) await retryDocumentCleanup(id);
}

export function startDocumentCleanup(): () => Promise<void> {
  let active: Promise<void> | undefined;
  const tick = () => {
    if (!active)
      active = processPendingDocumentCleanup()
        .catch(() => {
          console.warn("[server:moderation] cleanup sweep failed");
        })
        .finally(() => {
          active = undefined;
        });
  };
  const timer = setInterval(tick, 15_000);
  timer.unref();
  tick();
  return async () => {
    clearInterval(timer);
    await active;
    await Promise.all(running.values());
  };
}

async function withCleanupDeadline<T>(work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Cleanup timed out")), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
