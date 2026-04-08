import { and, eq, isNull } from "drizzle-orm";
import { generateId } from "../utils/generateId.js";
import { db } from "./client.js";
import { documentInvitations, usersOnDocuments } from "./schema.js";

type Params = {
  userId: string;
  documentId: string;
};

export const createOrRefreshDocumentInvitation = async ({
  userId,
  documentId,
}: Params) => {
  return db.transaction(async (tx) => {
    const admin = await tx
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

    if (admin.length === 0) {
      throw new Error("Document not found or user is not an admin");
    }

    await tx
      .delete(documentInvitations)
      .where(
        and(
          eq(documentInvitations.documentId, documentId),
          eq(documentInvitations.scope, "share"),
          isNull(documentInvitations.revokedAt),
        ),
      );

    const [invitation] = await tx
      .insert(documentInvitations)
      .values({
        documentId,
        token: generateId(),
        scope: "share",
        createdAt: new Date(),
        lastUsedAt: new Date(),
      })
      .returning();

    return invitation;
  });
};
