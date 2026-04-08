import { describe, expect, it } from "bun:test";
import * as opaque from "@serenity-kit/opaque";
import { ensureServerAdminUser } from "./ensureServerAdminUser.js";
import { getServerAdminByBasicAuth } from "./getServerAdminByBasicAuth.js";
import { getUserByUsername } from "./getUserByUsername.js";

describe("Server admin bootstrap", () => {
  it("creates a missing user, promotes them to server admin, and verifies basic auth", async () => {
    await opaque.ready;
    process.env.OPAQUE_SERVER_SETUP ??= opaque.server.createSetup();

    const user = await ensureServerAdminUser({
      username: "admin",
      password: "asdfjkl;",
    });

    expect(user).not.toBeNull();
    expect(user?.username).toBe("admin");
    expect(user?.isServerAdmin).toBe(true);

    const authenticated = await getServerAdminByBasicAuth(
      `Basic ${Buffer.from("admin:asdfjkl;").toString("base64")}`,
    );
    expect(authenticated).toEqual({
      id: user!.id,
      username: "admin",
    });
  });

  it("is idempotent for an existing user", async () => {
    await opaque.ready;
    process.env.OPAQUE_SERVER_SETUP ??= opaque.server.createSetup();

    const first = await ensureServerAdminUser({
      username: "admin",
      password: "asdfjkl;",
    });
    const second = await ensureServerAdminUser({
      username: "admin",
      password: "asdfjkl;",
    });

    expect(second?.id).toBe(first?.id);
    expect(second?.isServerAdmin).toBe(true);
    expect(await getUserByUsername("admin")).not.toBeNull();
  });
});
