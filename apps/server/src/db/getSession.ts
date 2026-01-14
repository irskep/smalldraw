import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { sessions } from "./schema.js";

export const getSession = async (sessionKey: string) => {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.sessionKey, sessionKey))
    .limit(1);
  return session ?? null;
};
