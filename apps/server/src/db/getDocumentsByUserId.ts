import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { documents, usersOnDocuments } from "./schema.js";

export const getDocumentsByUserId = async (userId: string) => {
  return db
    .select({ id: documents.id, name: documents.name })
    .from(documents)
    .innerJoin(usersOnDocuments, eq(usersOnDocuments.documentId, documents.id))
    .where(eq(usersOnDocuments.userId, userId));
};
