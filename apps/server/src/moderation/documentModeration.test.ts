import { afterEach, describe, expect, it } from "bun:test";

import { eq } from "drizzle-orm";

import {
  repo,
  repoStorage,
  documentLifetime,
  serverSharePolicy,
} from "../automergeRepo/automergeRepo.js";
import { snapshotCache } from "../automergeRepo/snapshotCache.js";
import { db } from "../db/client.js";
import { createAnonymousCollaborativeDocument } from "../db/createAnonymousCollaborativeDocument.js";
import { createDocument } from "../db/createDocument.js";
import { createUser } from "../db/createUser.js";
import { isDocumentBlocked } from "../db/documentModeration.js";
import { findOrCreateDocumentToken } from "../db/documentTokens.js";
import { getDeletedDocumentsByUserId } from "../db/getDeletedDocumentsByUserId.js";
import { getDocumentInvitationByToken } from "../db/getDocumentInvitationByToken.js";
import { getDocumentsByUserId } from "../db/getDocumentsByUserId.js";
import { restoreDocument } from "../db/restoreDocument.js";
import {
  documentModeration,
  documents,
  documentThumbnails,
} from "../db/schema.js";
import { syncAccountDocument } from "../db/syncAccountDocument.js";
import { setDocumentThumbnailStoreForTests } from "../storage/documentThumbnailStore.js";
import { publishDocumentThumbnail } from "../storage/publishDocumentThumbnail.js";
import {
  processPendingDocumentCleanup,
  retryDocumentCleanup,
  takeDownDocument,
} from "./documentModeration.js";

afterEach(() => setDocumentThumbnailStoreForTests(null));

async function guestDrawing() {
  const handle = repo.create({ lines: ["example"] });
  const result = await createAnonymousCollaborativeDocument({
    documentId: handle.documentId,
    ownerTag: "device",
  });
  await repo.flush([handle.documentId]);
  return { handle, result };
}

const takeDown = (documentId: string) =>
  takeDownDocument({
    documentId,
    administratorId: "admin-test",
    reason: "Test takedown",
  });

describe("moderation enforcement and cleanup", () => {
  it("advances feed time only for accepted content changes", async () => {
    const { handle } = await guestDrawing();
    db.update(documents)
      .set({ contentUpdatedAt: new Date(1000) })
      .where(eq(documents.id, handle.documentId))
      .run();
    handle.change(() => {});
    await repo.flush([handle.documentId]);
    expect(
      db
        .select()
        .from(documents)
        .where(eq(documents.id, handle.documentId))
        .get()!
        .contentUpdatedAt.getTime(),
    ).toBe(1000);
    handle.change((doc) => {
      doc.lines.push("next");
    });
    await repo.flush([handle.documentId]);
    expect(
      db
        .select()
        .from(documents)
        .where(eq(documents.id, handle.documentId))
        .get()!
        .contentUpdatedAt.getTime(),
    ).toBeGreaterThan(1000);
    db.update(documents)
      .set({ contentUpdatedAt: new Date(1000) })
      .where(eq(documents.id, handle.documentId))
      .run();
    await repo.removeFromCache(handle.documentId);
    const before = db
      .select()
      .from(documents)
      .where(eq(documents.id, handle.documentId))
      .get()!.contentUpdatedAt;
    const reopened = await repo.find(handle.documentId);
    await repo.flush([handle.documentId]);
    expect(reopened.doc()).toBeDefined();
    expect(
      db
        .select()
        .from(documents)
        .where(eq(documents.id, handle.documentId))
        .get()!.contentUpdatedAt,
    ).toEqual(before);
    await takeDown(handle.documentId);
  });

  it("revokes guest tokens, deletes live bytes and caches, and prevents re-registration", async () => {
    const { handle, result } = await guestDrawing();
    const id = handle.documentId;
    snapshotCache.get(id, handle.doc());
    await takeDown(id);
    expect(isDocumentBlocked(id)).toBe(true);
    expect(await getDocumentInvitationByToken(result.joinSecret)).toBeNull();
    expect(await getDocumentInvitationByToken(result.accessToken)).toBeNull();
    expect(repo.handles[id]).toBeUndefined();
    expect(await repoStorage.loadRange([id])).toEqual([]);
    await expect(serverSharePolicy("peer", id)).resolves.toBe(false);
    await expect(
      createAnonymousCollaborativeDocument({
        documentId: id,
        ownerTag: "device",
      }),
    ).rejects.toThrow("unavailable");
    await expect(
      findOrCreateDocumentToken({ documentId: id, scope: "owner" }),
    ).rejects.toThrow("unavailable");
    await expect(documentLifetime.use(id, async () => "read")).rejects.toThrow(
      "unavailable",
    );
    // The tombstone remains authoritative even if the metadata row is removed.
    db.delete(documents).where(eq(documents.id, id)).run();
    await expect(
      syncAccountDocument({ documentId: id, userId: "user" }),
    ).rejects.toThrow("unavailable");
    await repoStorage.save([id, "snapshot", "late"], new Uint8Array([1]));
    expect(await repoStorage.load([id, "snapshot", "late"])).toBeUndefined();
    // Bypass only the test's read barrier to prove bytes were physically removed.
    db.delete(documentModeration)
      .where(eq(documentModeration.documentId, id))
      .run();
    expect(await repoStorage.loadRange([id])).toEqual([]);
  });

  it("hides account content and rejects restore", async () => {
    const owner = await createUser({
      username: "moderated-owner",
      registrationRecord: "unused",
    });
    const handle = repo.create({ lines: [] });
    await createDocument({ userId: owner.id, documentId: handle.documentId });
    await takeDown(handle.documentId);
    expect(await getDocumentsByUserId(owner.id)).toEqual([]);
    expect(await getDeletedDocumentsByUserId(owner.id)).toEqual([]);
    await expect(
      restoreDocument({ documentId: handle.documentId, userId: owner.id }),
    ).rejects.toThrow("unavailable");
  });

  it("blocks immediately, waits for in-flight work, then discards a late scheduled flush", async () => {
    const { handle } = await guestDrawing();
    let finish!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = documentLifetime.use(handle.documentId, async () => {
      started();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      await repoStorage.save(
        [handle.documentId, "snapshot", "late"],
        new Uint8Array([99]),
      );
    });
    const rejected = pending.catch((error) => error);
    await ready;
    const removal = takeDown(handle.documentId);
    expect(isDocumentBlocked(handle.documentId)).toBe(true);
    finish();
    expect((await rejected).message).toContain("unavailable");
    await removal;
    expect(repo.handles[handle.documentId]).toBeUndefined();
  });

  it("removes a first thumbnail PUT that finishes after takedown", async () => {
    const { handle } = await guestDrawing();
    const objects = new Set<string>();
    let finish!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    setDocumentThumbnailStoreForTests({
      async getObject() {
        return new Uint8Array();
      },
      async deleteObject(key) {
        objects.delete(key);
      },
      async putObject({ key }) {
        started();
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        objects.add(key);
      },
    });
    const pending = publishDocumentThumbnail(
      handle.documentId,
      "image/png",
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM4sAAAAASUVORK5CYII=",
    ).catch((error) => error);
    await ready;
    const removal = takeDown(handle.documentId);
    finish();
    expect((await pending).message).toContain("unavailable");
    expect((await removal).cleanupState).toBe("complete");
    expect(objects.size).toBe(0);
  });

  it("bounds stalled cleanup without allowing late upload resurrection", async () => {
    const { handle } = await guestDrawing();
    let finish!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const objects = new Set<string>();
    setDocumentThumbnailStoreForTests({
      async getObject() {
        return new Uint8Array();
      },
      async deleteObject(key) {
        objects.delete(key);
      },
      async putObject({ key }) {
        started();
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        objects.add(key);
      },
    });
    const upload = publishDocumentThumbnail(
      handle.documentId,
      "image/png",
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM4sAAAAASUVORK5CYII=",
    ).catch((error) => error);
    await ready;
    const pending = await takeDown(handle.documentId);
    expect(pending.cleanupState).toBe("pending");
    expect(pending.lastError).toBeTruthy();
    const other = await guestDrawing();
    expect((await takeDown(other.handle.documentId)).cleanupState).toBe(
      "complete",
    );
    finish();
    await upload;
    await retryDocumentCleanup(handle.documentId);
    expect(objects.size).toBe(0);
  }, 10_000);

  it("retries failures and never falsely completes legacy direct-upload cleanup", async () => {
    const { handle } = await guestDrawing();
    const id = handle.documentId;
    const key = `documents/${id}/thumbnail.png`;
    db.insert(documentThumbnails)
      .values({ documentId: id, storageKey: key, contentType: "image/png" })
      .run();
    let fail = true;
    const removed: string[] = [];
    setDocumentThumbnailStoreForTests({
      async getObject() {
        return new Uint8Array();
      },
      async putObject() {},
      async deleteObject(k) {
        if (fail) throw new Error("secret-provider-response");
        removed.push(k);
      },
    });
    const blocked = await takeDown(id);
    expect(blocked.cleanupState).toBe("pending");
    expect(blocked.lastError).not.toContain("secret");
    expect(isDocumentBlocked(id)).toBe(true);
    fail = false;
    await retryDocumentCleanup(id);
    expect(removed).toContain(key);
    expect(
      db
        .select()
        .from(documentModeration)
        .where(eq(documentModeration.documentId, id))
        .get()?.cleanupState,
    ).toBe("pending");
    db.update(documentModeration)
      .set({
        takenDownAt: new Date(Date.now() - 302_000),
        nextRetryAt: new Date(0),
      })
      .where(eq(documentModeration.documentId, id))
      .run();
    await processPendingDocumentCleanup();
    expect(removed.filter((k) => k === key)).toHaveLength(2);
    const complete = db
      .select()
      .from(documentModeration)
      .where(eq(documentModeration.documentId, id))
      .get()!;
    expect(complete.cleanupState).toBe("pending");
    expect(complete.lastError).toBe("Legacy upload cleanup pending.");
    expect(complete.thumbnailStorageKey).toBeNull();
    await takeDown(id);
    expect(removed.filter((k) => k === key)).toHaveLength(3);
  });
});
