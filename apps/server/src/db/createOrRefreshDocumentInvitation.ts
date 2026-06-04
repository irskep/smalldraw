import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { rotateAnonymousCollaborativeDocumentShareToken } from "./rotateAnonymousCollaborativeDocumentShareToken.js";
import { documents, usersOnDocuments } from "./schema.js";

type Params = {
  userId: string;
  documentId: string;
};

export const createOrRefreshDocumentInvitation = async ({
  userId,
  documentId,
}: Params) => {
  const admin = await db
    .select({ userId: usersOnDocuments.userId })
    .from(usersOnDocuments)
    .innerJoin(documents, eq(documents.id, usersOnDocuments.documentId))
    .where(
      and(
        eq(usersOnDocuments.documentId, documentId),
        eq(usersOnDocuments.userId, userId),
        eq(usersOnDocuments.isAdmin, true),
        isNull(documents.deletedAt),
      ),
    )
    .limit(1);

  if (admin.length === 0) {
    throw new Error("Document not found or user is not an admin");
  }

  return await rotateAnonymousCollaborativeDocumentShareToken(documentId);
};
