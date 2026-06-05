import { describe, expect, it } from "bun:test";
import * as opaque from "@serenity-kit/opaque";
import { TRPCError } from "@trpc/server";
import { createDocument } from "../db/createDocument.js";
import { createLoginAttempt } from "../db/createLoginAttempt.js";
import { createSession } from "../db/createSession.js";
import { createUser } from "../db/createUser.js";
import { ensureServerAdminUser } from "../db/ensureServerAdminUser.js";
import { getLoginAttempt } from "../db/getLoginAttempt.js";
import { getSession } from "../db/getSession.js";
import { getUserByUsername } from "../db/getUserByUsername.js";
import { createOpaqueRegistrationRecord } from "../utils/createOpaqueRegistrationRecord.js";
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

  it("resets a user's password and revokes active sessions", async () => {
    await opaque.ready;
    process.env.OPAQUE_SERVER_SETUP ??= opaque.server.createSetup();
    const username = "reset-target";
    const oldRegistrationRecord = await createOpaqueRegistrationRecord({
      username,
      password: "old-password",
    });
    const user = await createUser({
      username,
      registrationRecord: oldRegistrationRecord,
    });
    await createSession({
      userId: user!.id,
      sessionKey: "active-session",
    });
    await createLoginAttempt({
      userId: user!.id,
      serverLoginState: "in-progress",
    });

    const adminCaller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: null,
      serverAdmin: {
        id: "server-admin",
        username: "admin",
      },
    });

    await expect(
      adminCaller.adminResetUserPassword({
        username,
        newPassword: "new-password",
      }),
    ).resolves.toMatchObject({
      id: user!.id,
      username,
      sessionsRevoked: true,
    });

    const resetUser = await getUserByUsername(username);
    expect(resetUser?.registrationRecord).not.toBe(oldRegistrationRecord);
    expect(await getSession("active-session")).toBeNull();
    expect(await getLoginAttempt(username)).toBeNull();

    const publicCaller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: createHeaderRecorder() as never,
      session: null,
      serverAdmin: null,
    });
    const { clientLoginState, startLoginRequest } = opaque.client.startLogin({
      password: "new-password",
    });
    const { loginResponse } = await publicCaller.loginStart({
      userIdentifier: username,
      startLoginRequest,
    });
    const loginResult = opaque.client.finishLogin({
      clientLoginState,
      loginResponse,
      password: "new-password",
    });

    expect(loginResult).not.toBeNull();
    await expect(
      publicCaller.loginFinish({
        userIdentifier: username,
        finishLoginRequest: loginResult!.finishLoginRequest,
      }),
    ).resolves.toEqual({ success: true });
  });

  it("rejects password reset for missing users", async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: null,
      serverAdmin: {
        id: "server-admin",
        username: "admin",
      },
    });

    await expect(
      caller.adminResetUserPassword({
        username: "missing-user",
        newPassword: "new-password",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows normal sessions for server-admin users", async () => {
    const admin = await ensureServerAdminUser({
      username: "session-admin",
      password: "asdfjkl;",
    });

    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "admin-session",
        userId: admin!.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await expect(caller.adminMe()).resolves.toEqual({
      id: admin!.id,
      username: "session-admin",
    });
  });

  it("rejects normal sessions for non-admin users", async () => {
    const user = await createUser({
      username: "not-admin",
      registrationRecord: "registration-record",
    });

    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "plain-session",
        userId: user.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await expect(caller.adminMe()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lists user documents and creates share links for them", async () => {
    const targetUser = await createUser({
      username: "drawing-owner",
      registrationRecord: "registration-record",
    });
    const document = await createDocument({
      documentId: "admin-visible-doc",
      userId: targetUser.id,
      name: "Admin visible drawing",
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: null,
      serverAdmin: {
        id: "server-admin",
        username: "admin",
      },
    });

    await expect(
      caller.adminListUserDocuments({ username: "drawing-owner" }),
    ).resolves.toMatchObject([
      {
        id: document.id,
        name: "Admin visible drawing",
        isAdmin: true,
      },
    ]);
    await expect(
      caller.adminCreateUserDocumentShareLink({
        username: "drawing-owner",
        documentId: document.id,
      }),
    ).resolves.toMatchObject({
      token: expect.any(String),
    });
  });

  it("rejects admin share link creation for documents outside the target user account", async () => {
    await createUser({
      username: "target-without-doc",
      registrationRecord: "registration-record",
    });
    const otherUser = await createUser({
      username: "other-owner",
      registrationRecord: "registration-record",
    });
    const document = await createDocument({
      documentId: "other-user-doc",
      userId: otherUser.id,
      name: "Other drawing",
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: null,
      serverAdmin: {
        id: "server-admin",
        username: "admin",
      },
    });

    await expect(
      caller.adminCreateUserDocumentShareLink({
        username: "target-without-doc",
        documentId: document.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

function createHeaderRecorder() {
  const headers = new Map<string, number | string | readonly string[]>();
  return {
    getHeader(name: string) {
      return headers.get(name);
    },
    setHeader(name: string, value: number | string | readonly string[]) {
      headers.set(name, value);
    },
  };
}
