import { and, eq } from "drizzle-orm";
import { generateId } from "../utils/generateId.js";
import { db } from "./client.js";
import { documentInvitations, documents } from "./schema.js";

type Params = {
  documentId: string;
  name?: string;
  ownerTag: string;
};

export const createAnonymousCollaborativeDocument = async ({
  documentId,
  name,
  ownerTag,
}: Params) => {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .get();
    if (existing) {
      const owner = tx
        .select()
        .from(documentInvitations)
        .where(
          and(
            eq(documentInvitations.documentId, documentId),
            eq(documentInvitations.scope, "owner"),
            eq(documentInvitations.tag, ownerTag),
          ),
        )
        .get();
      const share = tx
        .select()
        .from(documentInvitations)
        .where(
          and(
            eq(documentInvitations.documentId, documentId),
            eq(documentInvitations.scope, "share"),
          ),
        )
        .get();
      if (!owner || !share)
        throw new Error("Drawing registration belongs to another device.");
      return {
        document: existing,
        joinSecret: share.token,
        accessToken: owner.token,
      };
    }
    const now = new Date();
    const document = tx
      .insert(documents)
      .values({
        id: documentId,
        name: name ?? "Untitled",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    const shareToken = tx
      .insert(documentInvitations)
      .values({
        documentId,
        token: generateId(16),
        scope: "share",
        createdAt: now,
        lastUsedAt: now,
      })
      .returning()
      .get();
    const ownerToken = tx
      .insert(documentInvitations)
      .values({
        documentId,
        token: generateId(16),
        scope: "owner",
        tag: ownerTag,
        createdAt: now,
        lastUsedAt: now,
      })
      .returning()
      .get();

    return {
      document,
      joinSecret: shareToken.token,
      accessToken: ownerToken.token,
    };
  });
};
