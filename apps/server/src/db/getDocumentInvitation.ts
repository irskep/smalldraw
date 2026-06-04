import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documentInvitations, documents, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
};

export const getDocumentInvitation = async ({ documentId, userId }: Params) => {
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

  if (admin.length === 0) return null;

  const [invitation] = await db
    .select()
    .from(documentInvitations)
    .where(
      and(
        eq(documentInvitations.documentId, documentId),
        eq(documentInvitations.scope, "share"),
        isNull(documentInvitations.revokedAt),
      ),
    )
    .limit(1);

  return invitation ?? null;
};
