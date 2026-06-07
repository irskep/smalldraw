import { desc, eq } from "drizzle-orm";
import { db } from "./client.js";
import { sessions } from "./schema.js";

export const listSessionsForUser = async (userId: string) => {
  return await db
    .select({
      sessionKey: sessions.sessionKey,
      userId: sessions.userId,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));
};
