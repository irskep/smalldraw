import { db } from "./client.js";
import { findOrCreateDocumentToken } from "./documentTokens.js";
import { documents, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
};

export async function syncAccountDocument({ documentId, userId }: Params) {
  return await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .insert(documents)
      .values({
        id: documentId,
        name: "Untitled",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await tx
      .insert(usersOnDocuments)
      .values({ userId, documentId, isAdmin: true })
      .onConflictDoUpdate({
        target: [usersOnDocuments.userId, usersOnDocuments.documentId],
        set: { isAdmin: true },
      });
  });
}

export async function getOrCreateAccountDocumentOwnerToken(documentId: string) {
  return await findOrCreateDocumentToken({
    documentId,
    scope: "owner",
    tag: "account-sync",
  });
}
