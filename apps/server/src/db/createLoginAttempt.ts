import { db } from "./client.js";
import { loginAttempts } from "./schema.js";

type Params = {
  userId: string;
  serverLoginState: string;
};

export const createLoginAttempt = async ({
  userId,
  serverLoginState,
}: Params) => {
  const [attempt] = await db
    .insert(loginAttempts)
    .values({ userId, serverLoginState })
    .onConflictDoUpdate({
      target: loginAttempts.userId,
      set: {
        serverLoginState,
        createdAt: new Date(),
      },
    })
    .returning();

  return attempt;
};
