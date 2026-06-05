import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { users } from "./schema.js";

type Params = {
  userId: string;
  registrationRecord: string;
};

export const updateUserRegistrationRecord = async ({
  userId,
  registrationRecord,
}: Params) => {
  const [user] = await db
    .update(users)
    .set({ registrationRecord })
    .where(eq(users.id, userId))
    .returning();

  return user ?? null;
};
