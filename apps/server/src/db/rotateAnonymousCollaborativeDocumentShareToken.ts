import { and, eq, isNull } from "drizzle-orm";
import { generateId } from "../utils/generateId.js";
import { db } from "./client.js";
import { documentInvitations } from "./schema.js";

export const rotateAnonymousCollaborativeDocumentShareToken = async (
  documentId: string,
) => {
  return db.transaction(async (tx) => {
    await tx
      .update(documentInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(documentInvitations.documentId, documentId),
          eq(documentInvitations.scope, "share"),
          isNull(documentInvitations.revokedAt),
        ),
      );

    const now = new Date();
    const [shareToken] = await tx
      .insert(documentInvitations)
      .values({
        documentId,
        token: generateId(),
        scope: "share",
        createdAt: now,
        lastUsedAt: now,
      })
      .returning();

    return shareToken;
  });
};
