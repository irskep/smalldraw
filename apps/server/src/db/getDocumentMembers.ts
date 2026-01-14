import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { users, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
};

export const getDocumentMembers = async ({ documentId, userId }: Params) => {
  const membership = await db
    .select({ userId: usersOnDocuments.userId })
    .from(usersOnDocuments)
    .where(
      and(
        eq(usersOnDocuments.documentId, documentId),
        eq(usersOnDocuments.userId, userId)
      )
    )
    .limit(1);

  if (membership.length === 0) return null;

  return db
    .select({
      id: users.id,
      username: users.username,
      isAdmin: usersOnDocuments.isAdmin,
    })
    .from(usersOnDocuments)
    .innerJoin(users, eq(users.id, usersOnDocuments.userId))
    .where(eq(usersOnDocuments.documentId, documentId));
};
