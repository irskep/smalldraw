import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { users } from "./schema.js";

export const getUser = async (userId: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
};
