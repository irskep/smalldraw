import * as opaque from "@serenity-kit/opaque";
import { ensureServerAdminUser } from "../src/db/ensureServerAdminUser.js";

const username = process.env.ADMIN_USERNAME?.trim();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!username) {
  throw new Error("ADMIN_USERNAME is required");
}
if (password.length === 0) {
  throw new Error("ADMIN_PASSWORD is required");
}

await opaque.ready;
process.env.OPAQUE_SERVER_SETUP ??= opaque.server.createSetup();

const user = await ensureServerAdminUser({
  username,
  password,
});

console.log(
  JSON.stringify(
    {
      id: user?.id,
      username: user?.username,
      isServerAdmin: user?.isServerAdmin,
    },
    null,
    2,
  ),
);
