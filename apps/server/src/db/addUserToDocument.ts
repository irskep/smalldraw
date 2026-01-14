import { eq } from "drizzle-orm";
import { getUserHasAccessToDocument } from "./getUserHasAccessToDocument.js";
import { db } from "./client.js";
import { documentInvitations, usersOnDocuments } from "./schema.js";

type Params = {
  userId: string;
  documentInvitationToken: string;
};

export const addUserToDocument = async ({
  userId,
  documentInvitationToken,
}: Params) => {
  const [documentInvitation] = await db
    .select()
    .from(documentInvitations)
    .where(eq(documentInvitations.token, documentInvitationToken))
    .limit(1);

  if (!documentInvitation) {
    throw new Error("Invitation not found");
  }

  const hasAccessAlready = await getUserHasAccessToDocument({
    userId,
    documentId: documentInvitation.documentId,
  });

  if (hasAccessAlready) {
    return { documentId: documentInvitation.documentId };
  }

  await db.insert(usersOnDocuments).values({
    userId,
    documentId: documentInvitation.documentId,
    isAdmin: false,
  });

  return { documentId: documentInvitation.documentId };
};
