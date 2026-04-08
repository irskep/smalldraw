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
  return db.transaction(async (tx) => {
    const now = new Date();
    const [document] = await tx
      .insert(documents)
      .values({
        id: documentId,
        name: name ?? "Untitled",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [shareToken] = await tx
      .insert(documentInvitations)
      .values({
        documentId,
        token: generateId(16),
        scope: "share",
        createdAt: now,
        lastUsedAt: now,
      })
      .returning();
    const [ownerToken] = await tx
      .insert(documentInvitations)
      .values({
        documentId,
        token: generateId(16),
        scope: "owner",
        tag: ownerTag,
        createdAt: now,
        lastUsedAt: now,
      })
      .returning();

    return {
      document,
      joinSecret: shareToken.token,
      accessToken: ownerToken.token,
    };
  });
};
