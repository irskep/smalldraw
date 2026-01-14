import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { loginAttempts } from "./schema.js";

export const deleteLoginAttempt = async (userId: string) => {
  await db.delete(loginAttempts).where(eq(loginAttempts.userId, userId));
};
