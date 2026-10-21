import { and, eq } from "drizzle-orm";

import { db } from "./client.js";
import { findOrCreateDocumentToken } from "./documentTokens.js";
import { documents, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
};

export async function syncAccountDocument({ documentId, userId }: Params) {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .get();
    if (existing) {
      const membership = tx
        .select()
        .from(usersOnDocuments)
        .where(
          and(
            eq(usersOnDocuments.userId, userId),
            eq(usersOnDocuments.documentId, documentId),
          ),
        )
        .get();
      return !existing.deletedAt && membership?.isAdmin === true;
    }
    const now = new Date();
    tx.insert(documents)
      .values({
        id: documentId,
        name: "Untitled",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.insert(usersOnDocuments)
      .values({ userId, documentId, isAdmin: true })
      .run();
    return true;
  });
}

export async function getOrCreateAccountDocumentOwnerToken(documentId: string) {
  return await findOrCreateDocumentToken({
    documentId,
    scope: "owner",
    tag: "account-sync",
  });
}
