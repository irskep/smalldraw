import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documents, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
  name: string;
};

export const updateDocument = async ({ documentId, userId, name }: Params) => {
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
    throw new Error("Document not found or user lacks permission");
  }

  const [document] = await db
    .update(documents)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .returning();

  return document;
};
