import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { documents, usersOnDocuments } from "./schema.js";

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
    })
    .from(documents)
    .innerJoin(
      usersOnDocuments,
      and(
        eq(usersOnDocuments.documentId, documents.id),
        eq(usersOnDocuments.userId, userId),
      ),
    )
    .where(eq(documents.id, documentId))
    .limit(1);

  if (rows.length === 0) return null;

  return {
    id: rows[0].id,
    name: rows[0].name,
    createdAt: rows[0].createdAt,
    updatedAt: rows[0].updatedAt,
    isAdmin: !!rows[0].isAdmin,
  };
};
