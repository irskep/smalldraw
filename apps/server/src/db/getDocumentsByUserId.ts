import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { documents, documentThumbnails, usersOnDocuments } from "./schema.js";

export const getDocumentsByUserId = async (userId: string) => {
  return db
    .select({
      id: documents.id,
      name: documents.name,
      thumbnailStorageKey: documentThumbnails.storageKey,
      thumbnailContentType: documentThumbnails.contentType,
    })
    .from(documents)
    .innerJoin(usersOnDocuments, eq(usersOnDocuments.documentId, documents.id))
    .leftJoin(
      documentThumbnails,
      eq(documentThumbnails.documentId, documents.id),
    )
    .where(eq(usersOnDocuments.userId, userId));
};
