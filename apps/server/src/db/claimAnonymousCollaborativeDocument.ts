import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
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

  if (!existingMembership) {
    await db.insert(usersOnDocuments).values({
      userId,
      documentId: ownerToken.documentId,
      isAdmin: true,
    });
    return {
      documentId: ownerToken.documentId,
      attached: true,
      isAdmin: true,
    };
  }

  if (!existingMembership.isAdmin) {
    await db
      .update(usersOnDocuments)
      .set({ isAdmin: true })
      .where(
        and(
          eq(usersOnDocuments.userId, userId),
          eq(usersOnDocuments.documentId, ownerToken.documentId),
        ),
      );
  }

  return {
    documentId: ownerToken.documentId,
    attached: false,
    isAdmin: true,
  };
};
