import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { users } from "./schema.js";

export const promoteExistingServerAdmin = async (username: string) => {
  const [user] = await db
    .update(users)
    .set({ isServerAdmin: true })
    .where(eq(users.username, username))
    .returning();

  return user ?? null;
};
