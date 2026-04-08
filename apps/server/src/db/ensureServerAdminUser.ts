import { createOpaqueRegistrationRecord } from "../utils/createOpaqueRegistrationRecord.js";
import { createUser } from "./createUser.js";
import { getUserByUsername } from "./getUserByUsername.js";
import { upsertServerAdminCredential } from "./upsertServerAdminCredential.js";

export const ensureServerAdminUser = async ({
  username,
  password,
}: {
  username: string;
  password: string;
}) => {
  let user = await getUserByUsername(username);
  if (!user) {
    const registrationRecord = await createOpaqueRegistrationRecord({
      username,
      password,
    });
    user = await createUser({
      username,
      registrationRecord,
    });
  }

  await upsertServerAdminCredential({
    userId: user.id,
    password,
  });

  return await getUserByUsername(username);
};
