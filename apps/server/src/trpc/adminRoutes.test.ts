import { describe, expect, it } from "bun:test";
import * as opaque from "@serenity-kit/opaque";
import { TRPCError } from "@trpc/server";
import { createUser } from "../db/createUser.js";
import { ensureServerAdminUser } from "../db/ensureServerAdminUser.js";
import { appRouter } from "./appRouter.js";

describe("admin routes", () => {
  it("rejects anonymous access to admin routes", async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: null,
      serverAdmin: null,
    });

    await expect(caller.adminMe()).rejects.toBeInstanceOf(TRPCError);
  });

  it("allows server admin access to admin routes", async () => {
    await opaque.ready;
    process.env.OPAQUE_SERVER_SETUP ??= opaque.server.createSetup();
    const admin = await ensureServerAdminUser({
      username: "admin",
      password: "asdfjkl;",
    });
    await createUser({
      username: "plain-user",
      registrationRecord: "registration-record",
    });

    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: null,
      serverAdmin: {
        id: admin!.id,
        username: admin!.username,
      },
    });

    await expect(caller.adminMe()).resolves.toEqual({
      id: admin!.id,
      username: "admin",
    });
    await expect(
      caller.adminGetUserByUsername("plain-user"),
    ).resolves.toMatchObject({
      username: "plain-user",
      isServerAdmin: false,
    });
  });
});
