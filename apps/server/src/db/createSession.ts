import { db } from "./client.js";
import { sessions } from "./schema.js";

type Params = {
  sessionKey: string;
  userId: string;
};

export const createSession = async ({ sessionKey, userId }: Params) => {
  const [session] = await db
    .insert(sessions)
    .values({ sessionKey, userId })
    .returning();

  return session;
};
