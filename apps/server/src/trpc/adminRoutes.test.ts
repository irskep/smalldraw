import { describe, expect, it } from "bun:test";
import * as opaque from "@serenity-kit/opaque";
import { TRPCError } from "@trpc/server";
import { db } from "../db/client.js";
import { createDocument } from "../db/createDocument.js";
import { createLoginAttempt } from "../db/createLoginAttempt.js";
import { createSession } from "../db/createSession.js";
import { createUser } from "../db/createUser.js";
import { createDocumentToken } from "../db/documentTokens.js";
import { ensureServerAdminUser } from "../db/ensureServerAdminUser.js";
import { getLoginAttempt } from "../db/getLoginAttempt.js";
import { getSession } from "../db/getSession.js";
import { getUserByUsername } from "../db/getUserByUsername.js";
import { usersOnDocuments } from "../db/schema.js";
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

  it("lists and revokes user sessions", async () => {
    const user = await ensureServerAdminUser({
      username: "session-target",
      password: "asdfjkl;",
    });
    await createSession({
      userId: user!.id,
      sessionKey: "target-session-1",
    });
    await createSession({
      userId: user!.id,
      sessionKey: "target-session-2",
    });

    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "target-session-1",
        userId: user!.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    const listedSessions = await caller.adminListUserSessions({
      username: "session-target",
    });
    expect(listedSessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          isCurrentAdminSession: true,
        }),
        expect.objectContaining({
          id: expect.any(String),
          isCurrentAdminSession: false,
        }),
      ]),
    );
    expect(
      listedSessions.some((session) => session.id === "target-session-1"),
    ).toBe(false);
    const otherSession = listedSessions.find(
      (session) => !session.isCurrentAdminSession,
    );
    expect(otherSession).toBeDefined();

    await expect(
      caller.adminRevokeUserSession({
        username: "session-target",
        sessionId: otherSession!.id,
      }),
    ).resolves.toEqual({ revoked: 1 });
    expect(await getSession("target-session-1")).not.toBeNull();
    expect(await getSession("target-session-2")).toBeNull();

    await expect(
      caller.adminRevokeUserSessions({ username: "session-target" }),
    ).resolves.toEqual({ revoked: 1 });
    expect(await getSession("target-session-1")).toBeNull();
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
        currentAdminHasAccess: false,
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

  it("marks documents the viewing admin can already access", async () => {
    const admin = await ensureServerAdminUser({
      username: "document-member-admin",
      password: "asdfjkl;",
    });
    const targetUser = await createUser({
      username: "drawing-owner-with-admin-access",
      registrationRecord: "registration-record",
    });
    const document = await createDocument({
      documentId: "admin-member-doc",
      userId: targetUser.id,
      name: "Admin member drawing",
    });
    await db.insert(usersOnDocuments).values({
      userId: admin!.id,
      documentId: document.id,
      isAdmin: false,
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "document-member-admin-session",
        userId: admin!.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await expect(
      caller.adminListUserDocuments({
        username: "drawing-owner-with-admin-access",
      }),
    ).resolves.toMatchObject([
      {
        id: document.id,
        name: "Admin member drawing",
        currentAdminHasAccess: true,
      },
    ]);
    await expect(
      caller.adminCreateUserDocumentShareLink({
        username: "drawing-owner-with-admin-access",
        documentId: document.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("inspects a user's document members and access tokens", async () => {
    const targetUser = await createUser({
      username: "inspection-owner",
      registrationRecord: "registration-record",
    });
    const memberUser = await createUser({
      username: "inspection-member",
      registrationRecord: "registration-record",
    });
    const document = await createDocument({
      documentId: "inspection-doc",
      userId: targetUser.id,
      name: "Inspection drawing",
    });
    await db.insert(usersOnDocuments).values({
      userId: memberUser.id,
      documentId: document.id,
      isAdmin: false,
    });
    await createDocumentToken({
      documentId: document.id,
      scope: "owner",
      tag: "owner-device",
    });
    const deviceToken = await createDocumentToken({
      documentId: document.id,
      scope: "device",
      tag: "joiner-device",
    });
    await createDocumentToken({
      documentId: document.id,
      scope: "share",
      tag: "public-link",
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
      caller.adminGetUserDocumentDetails({
        username: "inspection-owner",
        documentId: document.id,
      }),
    ).resolves.toMatchObject({
      document: {
        id: document.id,
        name: "Inspection drawing",
      },
      members: expect.arrayContaining([
        expect.objectContaining({
          username: "inspection-owner",
          isAdmin: true,
        }),
        expect.objectContaining({
          username: "inspection-member",
          isAdmin: false,
        }),
      ]),
      accessTokens: expect.arrayContaining([
        expect.objectContaining({
          scope: "owner",
          tag: "owner-device",
        }),
        expect.objectContaining({
          scope: "device",
          tag: "joiner-device",
        }),
      ]),
    });
    const details = await caller.adminGetUserDocumentDetails({
      username: "inspection-owner",
      documentId: document.id,
    });
    expect(details.accessTokens.map((token) => token.scope).sort()).toEqual([
      "device",
      "owner",
    ]);
    await expect(
      caller.adminRevokeUserDocumentAccessToken({
        username: "inspection-owner",
        documentId: document.id,
        tokenId: deviceToken.id,
      }),
    ).resolves.toEqual({ revoked: true });
    const afterRevoke = await caller.adminGetUserDocumentDetails({
      username: "inspection-owner",
      documentId: document.id,
    });
    expect(
      afterRevoke.accessTokens.find((token) => token.id === deviceToken.id)
        ?.revokedAt,
    ).toBeInstanceOf(Date);
    const ownerToken = afterRevoke.accessTokens.find(
      (token) => token.scope === "owner",
    );
    expect(ownerToken).toBeDefined();
    await expect(
      caller.adminRevokeUserDocumentAccessToken({
        username: "inspection-owner",
        documentId: document.id,
        tokenId: ownerToken!.id,
      }),
    ).resolves.toEqual({ revoked: false });
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
    await expect(
      caller.adminGetUserDocumentDetails({
        username: "target-without-doc",
        documentId: document.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.adminRevokeUserDocumentAccessToken({
        username: "target-without-doc",
        documentId: document.id,
        tokenId: "token-id",
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
