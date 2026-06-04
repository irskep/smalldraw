import { and, eq, inArray, isNull } from "drizzle-orm";
import { generateId } from "../utils/generateId.js";
import { db } from "./client.js";
import {
  type DocumentInvitation,
  type DocumentTokenScope,
  documentInvitations,
  documents,
} from "./schema.js";

type CreateDocumentTokenParams = {
  documentId: string;
  scope: DocumentTokenScope;
  tag?: string | null;
};

type FindActiveDocumentTokenParams = {
  documentId: string;
  scope: DocumentTokenScope;
  tag?: string | null;
};

type GetActiveDocumentTokenByTokenParams = {
  token: string;
  scopes?: readonly DocumentTokenScope[];
};

export const createDocumentToken = async ({
  documentId,
  scope,
  tag,
}: CreateDocumentTokenParams): Promise<DocumentInvitation> => {
  const now = new Date();
  const [token] = await db
    .insert(documentInvitations)
    .values({
      documentId,
      token: generateId(16),
      scope,
      tag: tag ?? null,
      createdAt: now,
      lastUsedAt: now,
    })
    .returning();
  return token;
};

export const findActiveDocumentToken = async ({
  documentId,
  scope,
  tag,
}: FindActiveDocumentTokenParams): Promise<DocumentInvitation | null> => {
  const where = and(
    eq(documentInvitations.documentId, documentId),
    eq(documentInvitations.scope, scope),
    tag == null
      ? isNull(documentInvitations.tag)
      : eq(documentInvitations.tag, tag),
    isNull(documentInvitations.revokedAt),
    isNull(documents.deletedAt),
  );
  const [token] = await db
    .select()
    .from(documentInvitations)
    .innerJoin(documents, eq(documents.id, documentInvitations.documentId))
    .where(where)
    .limit(1);
  return token?.document_invitations ?? null;
};

export const findOrCreateDocumentToken = async ({
  documentId,
  scope,
  tag,
}: CreateDocumentTokenParams): Promise<DocumentInvitation> => {
  const existing = await findActiveDocumentToken({ documentId, scope, tag });
  if (existing) {
    return existing;
  }
  return await createDocumentToken({ documentId, scope, tag });
};

export const getActiveDocumentTokenByToken = async ({
  token,
  scopes,
}: GetActiveDocumentTokenByTokenParams): Promise<DocumentInvitation | null> => {
  if (!token) return null;
  const where = and(
    eq(documentInvitations.token, token),
    isNull(documentInvitations.revokedAt),
    isNull(documents.deletedAt),
    scopes && scopes.length > 0
      ? inArray(documentInvitations.scope, [...scopes])
      : undefined,
  );
  const [documentToken] = await db
    .select()
    .from(documentInvitations)
    .innerJoin(documents, eq(documents.id, documentInvitations.documentId))
    .where(where)
    .limit(1);
  return documentToken?.document_invitations ?? null;
};

export const revokeDocumentToken = async ({
  tokenId,
}: {
  tokenId: string;
}): Promise<void> => {
  await db
    .update(documentInvitations)
    .set({ revokedAt: new Date() })
    .where(eq(documentInvitations.id, tokenId));
};

export const touchDocumentToken = async ({
  tokenId,
}: {
  tokenId: string;
}): Promise<void> => {
  await db
    .update(documentInvitations)
    .set({ lastUsedAt: new Date() })
    .where(eq(documentInvitations.id, tokenId));
};
