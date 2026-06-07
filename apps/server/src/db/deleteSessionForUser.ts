import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { sessions } from "./schema.js";

export const deleteSessionForUser = async ({
  sessionKey,
  userId,
}: {
  sessionKey: string;
  userId: string;
}) => {
  const existing = await db
    .select({ sessionKey: sessions.sessionKey })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.sessionKey, sessionKey)))
    .limit(1);

  if (existing.length === 0) {
    return false;
  }

  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.sessionKey, sessionKey)));

  return true;
};
