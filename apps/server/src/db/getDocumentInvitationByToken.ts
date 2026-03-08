import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { documentInvitations } from "./schema.js";

export const getDocumentInvitationByToken = async (token: string) => {
  if (!token) return null;

  const [invitation] = await db
    .select()
    .from(documentInvitations)
    .where(eq(documentInvitations.token, token))
    .limit(1);

  return invitation ?? null;
};
