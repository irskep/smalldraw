import { and, eq } from "drizzle-orm";

import { db } from "./client.js";
import { assertDocumentAvailable } from "./documentModeration.js";
import { getActiveDocumentTokenByToken } from "./documentTokens.js";
import { usersOnDocuments } from "./schema.js";

type Params = {
  userId: string;
  accessToken: string;
};

export const claimAnonymousCollaborativeDocument = async ({
  userId,
  accessToken,
}: Params) => {
  const ownerToken = await getActiveDocumentTokenByToken({
    token: accessToken,
    scopes: ["owner"],
  });

  if (!ownerToken) {
    throw new Error("Owner token not found");
  }

  const [existingMembership] = await db
    .select()
    .from(usersOnDocuments)
    .where(
      and(
        eq(usersOnDocuments.userId, userId),
        eq(usersOnDocuments.documentId, ownerToken.documentId),
      ),
    )
    .limit(1);

  assertDocumentAvailable(ownerToken.documentId);
  if (!existingMembership) {
    db.insert(usersOnDocuments)
      .values({
        userId,
        documentId: ownerToken.documentId,
        isAdmin: true,
      })
      .run();
    return {
      documentId: ownerToken.documentId,
      attached: true,
      isAdmin: true,
    };
  }

  if (!existingMembership.isAdmin) {
    db.update(usersOnDocuments)
      .set({ isAdmin: true })
      .where(
        and(
          eq(usersOnDocuments.userId, userId),
          eq(usersOnDocuments.documentId, ownerToken.documentId),
        ),
      )
      .run();
  }

  return {
    documentId: ownerToken.documentId,
    attached: false,
    isAdmin: true,
  };
};
