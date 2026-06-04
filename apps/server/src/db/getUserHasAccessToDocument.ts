import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documents, usersOnDocuments } from "./schema.js";

type Params = {
  userId: string;
  documentId: string;
};

export const getUserHasAccessToDocument = async ({
  documentId,
  userId,
}: Params) => {
  if (!userId || !documentId) return false;

  const rows = await db
    .select({ userId: usersOnDocuments.userId })
    .from(usersOnDocuments)
    .innerJoin(documents, eq(documents.id, usersOnDocuments.documentId))
    .where(
      and(
        eq(usersOnDocuments.userId, userId),
        eq(usersOnDocuments.documentId, documentId),
        isNull(documents.deletedAt),
      ),
    )
    .limit(1);

  return rows.length > 0;
};
