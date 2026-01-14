import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { users } from "./schema.js";

export const getUserByUsername = async (username: string) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return user ?? null;
};
