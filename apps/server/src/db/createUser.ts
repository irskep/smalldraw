import { db } from "./client.js";
import { users } from "./schema.js";

type Params = {
  username: string;
  registrationRecord: string;
};

export const createUser = async ({ username, registrationRecord }: Params) => {
  const [user] = await db
    .insert(users)
    .values({
      username,
      registrationRecord,
    })
    .returning();

  return user;
};
