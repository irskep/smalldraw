import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documents, users, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
};

export const getDocumentMembers = async ({ documentId, userId }: Params) => {
  const membership = await db
    .select({ userId: usersOnDocuments.userId })
    .from(usersOnDocuments)
    .innerJoin(documents, eq(documents.id, usersOnDocuments.documentId))
    .where(
      and(
        eq(usersOnDocuments.documentId, documentId),
        eq(usersOnDocuments.userId, userId),
        isNull(documents.deletedAt),
      ),
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
    .innerJoin(documents, eq(documents.id, usersOnDocuments.documentId))
    .where(
      and(
        eq(usersOnDocuments.documentId, documentId),
        isNull(documents.deletedAt),
      ),
    );
};
