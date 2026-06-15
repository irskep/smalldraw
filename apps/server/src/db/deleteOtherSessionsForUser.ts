import { and, eq, ne } from "drizzle-orm";
import { db } from "./client.js";
import { sessions } from "./schema.js";

export const deleteOtherSessionsForUser = async ({
  currentSessionKey,
  userId,
}: {
  currentSessionKey: string;
  userId: string;
}) => {
  const deleted = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.sessionKey, currentSessionKey),
      ),
    )
    .returning({ sessionKey: sessions.sessionKey });

  return deleted.length;
};
