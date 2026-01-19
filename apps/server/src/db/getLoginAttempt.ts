import { and, eq, gte } from "drizzle-orm";
import { db } from "./client.js";
import { loginAttempts, users } from "./schema.js";

export const getLoginAttempt = async (username: string) => {
  const threshold = new Date(Date.now() - 8_000);

  const rows = await db
    .select({ attempt: loginAttempts })
    .from(loginAttempts)
    .innerJoin(users, eq(users.id, loginAttempts.userId))
    .where(
      and(
        eq(users.username, username),
        gte(loginAttempts.createdAt, threshold),
      ),
    )
    .limit(1);

  return rows.length > 0 ? rows[0].attempt : null;
};
