import { and, eq } from "drizzle-orm";
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
    .where(
      and(
        eq(usersOnDocuments.documentId, documentId),
        eq(usersOnDocuments.userId, userId),
        eq(usersOnDocuments.isAdmin, true)
      )
    )
    .limit(1);

  if (admin.length === 0) {
    throw new Error("Document not found or user lacks permission");
  }

  const [document] = await db
    .update(documents)
    .set({ name, updatedAt: new Date() })
    .where(eq(documents.id, documentId))
    .returning();

  return document;
};
