import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { documents, users, usersOnDocuments } from "./schema.js";

type Params = {
  documentId: string;
};

export const listDocumentMembersForServerAdmin = async ({
  documentId,
}: Params) => {
  return await db
    .select({
      id: users.id,
      username: users.username,
      isAdmin: usersOnDocuments.isAdmin,
    })
    .from(usersOnDocuments)
    .innerJoin(users, eq(users.id, usersOnDocuments.userId))
    .innerJoin(documents, eq(documents.id, usersOnDocuments.documentId))
    .where(
      and(
        eq(usersOnDocuments.documentId, documentId),
        isNull(documents.deletedAt),
      ),
    );
};
