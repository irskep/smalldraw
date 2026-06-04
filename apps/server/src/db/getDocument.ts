import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documents, documentThumbnails, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
};

export const getDocument = async ({ documentId, userId }: Params) => {
  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      isAdmin: usersOnDocuments.isAdmin,
      thumbnailStorageKey: documentThumbnails.storageKey,
      thumbnailContentType: documentThumbnails.contentType,
    })
    .from(documents)
    .innerJoin(
      usersOnDocuments,
      and(
        eq(usersOnDocuments.documentId, documents.id),
        eq(usersOnDocuments.userId, userId),
      ),
    )
    .leftJoin(
      documentThumbnails,
      eq(documentThumbnails.documentId, documents.id),
    )
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .limit(1);

  if (rows.length === 0) return null;

  return {
    id: rows[0].id,
    name: rows[0].name,
    createdAt: rows[0].createdAt,
    updatedAt: rows[0].updatedAt,
    isAdmin: !!rows[0].isAdmin,
    thumbnailStorageKey: rows[0].thumbnailStorageKey,
    thumbnailContentType: rows[0].thumbnailContentType,
  };
};
