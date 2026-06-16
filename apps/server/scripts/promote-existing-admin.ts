import { promoteExistingServerAdmin } from "../src/db/promoteExistingServerAdmin.js";

const username = process.env.ADMIN_USERNAME?.trim() || "admin";

const user = await promoteExistingServerAdmin(username);

if (!user) {
  throw new Error(`User not found: ${username}`);
}

console.log(
  JSON.stringify(
    {
      id: user.id,
      username: user.username,
      isServerAdmin: user.isServerAdmin,
    },
    null,
    2,
  ),
);
