import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { sessions } from "./schema.js";

export const deleteSessionsForUser = async (userId: string) => {
  await db.delete(sessions).where(eq(sessions.userId, userId));
};
