import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documents, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
};

export const removeDocumentFromAccount = async ({
  documentId,
  userId,
}: Params) => {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ documentId: usersOnDocuments.documentId })
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

    if (!membership) {
      throw new Error("Document not found");
    }

    await tx
      .delete(usersOnDocuments)
      .where(
        and(
          eq(usersOnDocuments.documentId, documentId),
          eq(usersOnDocuments.userId, userId),
        ),
      );

    return { id: documentId };
  });
};
