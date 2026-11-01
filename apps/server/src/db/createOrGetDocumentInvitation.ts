import { and, eq, isNull } from "drizzle-orm";

import { db } from "./client.js";
import { rotateAnonymousCollaborativeDocumentShareToken } from "./rotateAnonymousCollaborativeDocumentShareToken.js";
import { documentInvitations, documents, usersOnDocuments } from "./schema.js";

type Params = {
  userId: string;
  documentId: string;
};

export const createOrGetDocumentInvitation = async ({
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

  const existing = db
    .select()
    .from(documentInvitations)
    .where(
      and(
        eq(documentInvitations.documentId, documentId),
        eq(documentInvitations.scope, "share"),
        isNull(documentInvitations.revokedAt),
      ),
    )
    .get();
  // Merely opening sharing must never renew or replace an invitation.
  return (
    existing ??
    (await rotateAnonymousCollaborativeDocumentShareToken(documentId))
  );
};
