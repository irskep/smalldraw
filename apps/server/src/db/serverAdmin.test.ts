import { describe, expect, it } from "bun:test";
import * as opaque from "@serenity-kit/opaque";
import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { createUser } from "./createUser.js";
import { ensureServerAdminUser } from "./ensureServerAdminUser.js";
import { getServerAdminByBasicAuth } from "./getServerAdminByBasicAuth.js";
import { getUserByUsername } from "./getUserByUsername.js";
import { promoteExistingServerAdmin } from "./promoteExistingServerAdmin.js";
import { serverAdminCredentials } from "./schema.js";

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

  it("promotes an existing user without changing their registration record or creating basic auth credentials", async () => {
    const user = await createUser({
      username: "admin",
      registrationRecord: "existing-registration-record",
    });

    const promoted = await promoteExistingServerAdmin("admin");

    expect(promoted?.id).toBe(user.id);
    expect(promoted?.username).toBe("admin");
    expect(promoted?.isServerAdmin).toBe(true);

    const reloaded = await getUserByUsername("admin");
    expect(reloaded?.registrationRecord).toBe("existing-registration-record");

    const credentials = await db
      .select()
      .from(serverAdminCredentials)
      .where(eq(serverAdminCredentials.userId, user.id));
    expect(credentials).toEqual([]);
  });

  it("does not create a missing user when promoting an existing admin", async () => {
    const promoted = await promoteExistingServerAdmin("admin");

    expect(promoted).toBeNull();
    expect(await getUserByUsername("admin")).toBeNull();
  });
});
