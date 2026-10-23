import { drawingDocumentId, parseDrawingAppUrl } from "@smalldraw/shared";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "./client.js";
import {
  documents,
  documentModeration,
  documentInvitations,
  documentThumbnails,
  users,
  usersOnDocuments,
} from "./schema.js";

export type ModerationFilter = "all" | "shared" | "taken-down";
export type ModerationCursor = { at: number; id: string };
const isShared = sql<boolean>`exists (select 1 from document_invitations i where i.document_id = ${documents.id} and i.scope = 'share' and i.revoked_at is null)`;

function moderationSummary(row: typeof documentModeration.$inferSelect) {
  return {
    takenDownAt: row.takenDownAt.getTime(),
    administratorId: row.administratorId,
    reason: row.reason,
    cleanupState: row.cleanupState,
    lastError: row.lastError,
    cleanupAttempts: row.cleanupAttempts,
    completedAt: row.completedAt?.getTime() ?? null,
  };
}

async function summaries(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({
      document: documents,
      shared: isShared,
      thumbnailId: documentThumbnails.documentId,
    })
    .from(documents)
    .leftJoin(
      documentThumbnails,
      eq(documentThumbnails.documentId, documents.id),
    )
    .where(inArray(documents.id, ids));
  const members = await db
    .select({
      documentId: usersOnDocuments.documentId,
      id: users.id,
      username: users.username,
    })
    .from(usersOnDocuments)
    .innerJoin(users, eq(users.id, usersOnDocuments.userId))
    .where(
      and(
        inArray(usersOnDocuments.documentId, ids),
        eq(usersOnDocuments.isAdmin, true),
      ),
    );
  const blocks = await db
    .select()
    .from(documentModeration)
    .where(inArray(documentModeration.documentId, ids));
  const byId = new Map(rows.map((row) => [row.document.id, row]));
  const blockById = new Map(blocks.map((row) => [row.documentId, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    const block = blockById.get(id);
    if (!row && !block) return [];
    return [
      {
        id,
        createdAt:
          row?.document.createdAt.getTime() ?? block!.takenDownAt.getTime(),
        contentUpdatedAt:
          row?.document.contentUpdatedAt.getTime() ??
          block!.takenDownAt.getTime(),
        deletedAt: row?.document.deletedAt?.getTime() ?? null,
        shared: !block && Boolean(row?.shared),
        hasThumbnail: !block && Boolean(row?.thumbnailId),
        owners: members
          .filter((member) => member.documentId === id)
          .map(({ id, username }) => ({ id, username })),
        moderation: block ? moderationSummary(block) : null,
      },
    ];
  });
}

export async function listModerationDrawings(input: {
  filter: ModerationFilter;
  cursor?: ModerationCursor;
  limit: number;
}) {
  const { filter, cursor, limit } = input;
  const rows =
    filter === "taken-down"
      ? await db
          .select({
            id: documentModeration.documentId,
            at: documentModeration.takenDownAt,
          })
          .from(documentModeration)
          .where(
            cursor
              ? sql`(${documentModeration.takenDownAt}, ${documentModeration.documentId}) < (${Math.floor(cursor.at / 1000)}, ${cursor.id})`
              : undefined,
          )
          .orderBy(
            desc(documentModeration.takenDownAt),
            desc(documentModeration.documentId),
          )
          .limit(limit + 1)
      : await db
          .select({ id: documents.id, at: documents.contentUpdatedAt })
          .from(documents)
          .leftJoin(
            documentModeration,
            eq(documentModeration.documentId, documents.id),
          )
          .where(
            and(
              isNull(documentModeration.documentId),
              filter === "shared" ? isShared : undefined,
              cursor
                ? sql`(${documents.contentUpdatedAt}, ${documents.id}) < (${Math.floor(cursor.at / 1000)}, ${cursor.id})`
                : undefined,
            ),
          )
          .orderBy(desc(documents.contentUpdatedAt), desc(documents.id))
          .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: await summaries(page.map((row) => row.id)),
    nextCursor:
      rows.length > limit && last
        ? { at: last.at.getTime(), id: last.id }
        : null,
  };
}

export async function getModerationDrawing(documentId: string) {
  const [summary] = await summaries([documentId]);
  if (!summary) return null;
  const tokens = summary.moderation
    ? []
    : await db
        .select({ token: documentInvitations.token })
        .from(documentInvitations)
        .where(
          and(
            eq(documentInvitations.documentId, documentId),
            eq(documentInvitations.scope, "share"),
            isNull(documentInvitations.revokedAt),
          ),
        );
  return { ...summary, shareTokens: tokens.map((row) => row.token) };
}

export async function findModerationDrawing(lookup: string) {
  let id: string | undefined;
  const plain = drawingDocumentId(lookup.trim());
  if (/^[A-Za-z0-9_-]+$/.test(plain)) id = plain;
  else {
    const url = new URL(lookup.trim(), "https://drawing.invalid");
    const invitation = url.pathname.match(/^\/invitation\/([^/]+)\/?$/);
    const intent = invitation
      ? {
          kind: "open-share-link" as const,
          joinSecret: decodeURIComponent(invitation[1]!),
        }
      : parseDrawingAppUrl(lookup.trim());
    switch (intent.kind) {
      case "open-document":
      case "open-account-document":
        id = intent.documentId;
        break;
      case "open-local-document":
        id = drawingDocumentId(intent.docUrl);
        break;
      case "open-share-link": {
        // Revoked links still identify a takedown for an administrator.
        const [token] = await db
          .select({ id: documentInvitations.documentId })
          .from(documentInvitations)
          .where(eq(documentInvitations.token, intent.joinSecret))
          .limit(1);
        id = token?.id;
        break;
      }
    }
  }
  return id ? getModerationDrawing(id) : null;
}
