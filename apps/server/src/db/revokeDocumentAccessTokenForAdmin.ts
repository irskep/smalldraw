import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documentInvitations, usersOnDocuments } from "./schema.js";

type Params = {
  userId: string;
  documentId: string;
  tokenId: string;
};

export const revokeDocumentAccessTokenForAdmin = async ({
  userId,
  documentId,
  tokenId,
}: Params) => {
  const admin = await db
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

  const [token] = await db
    .select({
      id: documentInvitations.id,
      scope: documentInvitations.scope,
      revokedAt: documentInvitations.revokedAt,
    })
    .from(documentInvitations)
    .where(
      and(
        eq(documentInvitations.id, tokenId),
        eq(documentInvitations.documentId, documentId),
      ),
    )
    .limit(1);

  if (!token || token.scope !== "device" || token.revokedAt) {
    return false;
  }

  await db
    .update(documentInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(documentInvitations.id, tokenId),
        eq(documentInvitations.documentId, documentId),
        eq(documentInvitations.scope, "device"),
        isNull(documentInvitations.revokedAt),
      ),
    );

  return true;
};
