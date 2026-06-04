import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documents, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
  userId: string;
};

export const deleteDocument = async ({ documentId, userId }: Params) => {
  return db.transaction(async (tx) => {
    const [documentRow] = await tx
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
      .limit(1);

    if (!documentRow) {
      throw new Error("Document not found");
    }

    const [membership] = await tx
      .select({ userId: usersOnDocuments.userId })
      .from(usersOnDocuments)
      .where(
        and(
          eq(usersOnDocuments.documentId, documentId),
          eq(usersOnDocuments.userId, userId),
          eq(usersOnDocuments.isAdmin, true),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new Error("User lacks delete permission");
    }

    const now = new Date();
    const [document] = await tx
      .update(documents)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
      .returning({
        id: documents.id,
        deletedAt: documents.deletedAt,
      });

    if (!document) {
      throw new Error("Document not found");
    }
    if (!document.deletedAt) {
      throw new Error("Document deletion did not persist a deletion timestamp");
    }

    return {
      id: document.id,
      deletedAt: document.deletedAt,
    };
  });
};
