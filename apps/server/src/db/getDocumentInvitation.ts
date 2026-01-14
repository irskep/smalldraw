import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { documentInvitations, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
};

export const getDocumentInvitation = async ({ documentId, userId }: Params) => {
  const admin = await db
    .select({ userId: usersOnDocuments.userId })
    .from(usersOnDocuments)
    .where(
      and(
        eq(usersOnDocuments.documentId, documentId),
        eq(usersOnDocuments.userId, userId),
        eq(usersOnDocuments.isAdmin, true)
      )
    )
    .limit(1);

  if (admin.length === 0) return null;

  const [invitation] = await db
    .select()
    .from(documentInvitations)
    .where(eq(documentInvitations.documentId, documentId))
    .limit(1);

  return invitation ?? null;
};
