import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { usersOnDocuments } from "./schema.js";

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
    .where(
      and(
        eq(usersOnDocuments.userId, userId),
        eq(usersOnDocuments.documentId, documentId),
      ),
    )
    .limit(1);

  return rows.length > 0;
};
