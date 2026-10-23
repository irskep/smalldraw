import { and, eq, isNull } from "drizzle-orm";

import { generateId } from "../utils/generateId.js";
import { db } from "./client.js";
import { assertDocumentAvailable } from "./documentModeration.js";
import { documentInvitations } from "./schema.js";

export const rotateAnonymousCollaborativeDocumentShareToken = async (
  documentId: string,
) => {
  assertDocumentAvailable(documentId);
  return db.transaction((tx) => {
    tx.update(documentInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(documentInvitations.documentId, documentId),
          eq(documentInvitations.scope, "share"),
          isNull(documentInvitations.revokedAt),
        ),
      )
      .run();

    const now = new Date();
    const shareToken = tx
      .insert(documentInvitations)
      .values({
        documentId,
        token: generateId(),
        scope: "share",
        createdAt: now,
        lastUsedAt: now,
      })
      .returning()
      .get();

    return shareToken;
  });
};
