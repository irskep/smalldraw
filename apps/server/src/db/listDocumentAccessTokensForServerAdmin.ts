import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "./client.js";
import { documentInvitations, documents } from "./schema.js";

type Params = {
  documentId: string;
};

export const listDocumentAccessTokensForServerAdmin = async ({
  documentId,
}: Params) => {
  return await db
    .select({
      id: documentInvitations.id,
      documentId: documentInvitations.documentId,
      scope: documentInvitations.scope,
      tag: documentInvitations.tag,
      createdAt: documentInvitations.createdAt,
      lastUsedAt: documentInvitations.lastUsedAt,
      revokedAt: documentInvitations.revokedAt,
    })
    .from(documentInvitations)
    .innerJoin(documents, eq(documents.id, documentInvitations.documentId))
    .where(
      and(
        eq(documentInvitations.documentId, documentId),
        ne(documentInvitations.scope, "share"),
        isNull(documents.deletedAt),
      ),
    );
};
