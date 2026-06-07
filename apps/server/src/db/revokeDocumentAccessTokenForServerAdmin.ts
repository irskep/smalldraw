import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documentInvitations } from "./schema.js";

export const revokeDocumentAccessTokenForServerAdmin = async ({
  documentId,
  tokenId,
}: {
  documentId: string;
  tokenId: string;
}) => {
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
