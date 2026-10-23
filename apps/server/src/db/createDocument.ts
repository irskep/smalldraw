import { generateId } from "../utils/generateId.js";
import { db } from "./client.js";
import { assertDocumentAvailable } from "./documentModeration.js";
import { documentInvitations, documents, usersOnDocuments } from "./schema.js";

type Params = {
  userId: string;
  documentId: string;
  name?: string;
};

export const createDocument = async ({ userId, documentId, name }: Params) => {
  assertDocumentAvailable(documentId);
  return db.transaction((tx) => {
    const now = new Date();
    const document = tx
      .insert(documents)
      .values({
        id: documentId,
        name: name ?? "Untitled",
        createdAt: now,
        updatedAt: now,
        contentUpdatedAt: now,
      })
      .returning()
      .get();

    tx.insert(usersOnDocuments)
      .values({ userId, documentId, isAdmin: true })
      .run();

    tx.insert(documentInvitations)
      .values({
        documentId,
        token: generateId(16),
        scope: "share",
        createdAt: now,
        lastUsedAt: now,
      })
      .run();

    return document;
  });
};
