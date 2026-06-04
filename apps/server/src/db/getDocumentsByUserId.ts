import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documents, documentThumbnails, usersOnDocuments } from "./schema.js";

export const getDocumentsByUserId = async (userId: string) => {
  return db
    .select({
      id: documents.id,
      name: documents.name,
      isAdmin: usersOnDocuments.isAdmin,
      thumbnailStorageKey: documentThumbnails.storageKey,
      thumbnailContentType: documentThumbnails.contentType,
    })
    .from(documents)
    .innerJoin(usersOnDocuments, eq(usersOnDocuments.documentId, documents.id))
    .leftJoin(
      documentThumbnails,
      eq(documentThumbnails.documentId, documents.id),
    )
    .where(
      and(eq(usersOnDocuments.userId, userId), isNull(documents.deletedAt)),
    )
    .orderBy(desc(documents.createdAt));
};
