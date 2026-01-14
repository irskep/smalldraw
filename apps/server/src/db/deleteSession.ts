import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { sessions } from "./schema.js";

export const deleteSession = async (sessionKey: string) => {
  await db.delete(sessions).where(eq(sessions.sessionKey, sessionKey));
};
