import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "./client.js";
import { documentInvitations, documents, usersOnDocuments } from "./schema.js";

type Params = {
  userId: string;
  documentId: string;
};

export const listDocumentAccessTokensForAdmin = async ({
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

  return await db
    .select({
      id: documentInvitations.id,
      documentId: documentInvitations.documentId,
      scope: documentInvitations.scope,
      tag: documentInvitations.tag,
      createdAt: documentInvitations.createdAt,
      lastUsedAt: documentInvitations.lastUsedAt,
      revokedAt: documentInvitations.revokedAt,
    })
    .from(documentInvitations)
    .where(
      and(
        eq(documentInvitations.documentId, documentId),
        ne(documentInvitations.scope, "share"),
      ),
    );
};
