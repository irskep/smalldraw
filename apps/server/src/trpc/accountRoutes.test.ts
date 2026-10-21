import { describe, expect, it } from "bun:test";

import {
  generateAutomergeUrl,
  parseAutomergeUrl,
} from "@automerge/automerge-repo";
import * as opaque from "@serenity-kit/opaque";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { createSession } from "../db/createSession.js";
import { createUser } from "../db/createUser.js";
import { getLoginAttempt } from "../db/getLoginAttempt.js";
import { getSession } from "../db/getSession.js";
import { getUserByUsername } from "../db/getUserByUsername.js";
import {
  documentInvitations,
  documents,
  usersOnDocuments,
} from "../db/schema.js";
import { apiRouter as appRouter } from "../test/apiCaller";
import { createOpaqueRegistrationRecord } from "../utils/createOpaqueRegistrationRecord.js";

describe("account routes", () => {
  it("changes the current user's password and revokes other sessions", async () => {
    await opaque.ready;
    process.env.OPAQUE_SERVER_SETUP ??= opaque.server.createSetup();
    const username = "self-service-password-user";
    const oldRegistrationRecord = await createOpaqueRegistrationRecord({
      username,
      password: "old-password",
    });
    const user = await createUser({
      username,
      registrationRecord: oldRegistrationRecord,
    });
    await createSession({
      userId: user.id,
      sessionKey: "current-session",
    });
    await createSession({
      userId: user.id,
      sessionKey: "other-session",
    });

    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "current-session",
        userId: user.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });
    const { clientLoginState, startLoginRequest } = opaque.client.startLogin({
      password: "old-password",
    });
    const { clientRegistrationState, registrationRequest } =
      opaque.client.startRegistration({ password: "new-password" });

    const { loginResponse, registrationResponse } =
      await caller.changePasswordStart({
        currentPasswordLoginRequest: startLoginRequest,
        newPasswordRegistrationRequest: registrationRequest,
      });
    const loginResult = opaque.client.finishLogin({
      clientLoginState,
      loginResponse,
      password: "old-password",
    });
    expect(loginResult).not.toBeNull();
    const { registrationRecord } = opaque.client.finishRegistration({
      clientRegistrationState,
      registrationResponse,
      password: "new-password",
    });

    await expect(
      caller.changePasswordFinish({
        currentPasswordFinishRequest: loginResult!.finishLoginRequest,
        newPasswordRegistrationRecord: registrationRecord,
      }),
    ).resolves.toEqual({
      success: true,
      sessionsRevoked: 1,
    });

    const updatedUser = await getUserByUsername(username);
    expect(updatedUser?.registrationRecord).not.toBe(oldRegistrationRecord);
    expect(await getSession("current-session")).not.toBeNull();
    expect(await getSession("other-session")).toBeNull();
    expect(await getLoginAttempt(username)).toBeNull();

    expect(await expectPasswordLogin(username, "new-password")).toBe(true);
    expect(await expectPasswordLogin(username, "old-password")).toBe(false);
  });

  it("rejects password changes without an authenticated session", async () => {
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: null,
      serverAdmin: null,
    });

    await expect(
      caller.changePasswordStart({
        currentPasswordLoginRequest: "login-request",
        newPasswordRegistrationRequest: "registration-request",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("saves account settings and verifies the account PIN", async () => {
    const user = await createUser({
      username: "settings-user",
      registrationRecord: "registration-record",
    });
    const caller = createAuthenticatedCaller(user.id, "settings-session");

    expect(await caller.accountSettings()).toEqual({
      shareMode: "allowed",
      hasPin: false,
    });

    await expect(
      caller.saveAccountSettings({
        shareMode: "pin_required",
        pinChange: { type: "set", pin: "2468" },
      }),
    ).resolves.toEqual({
      shareMode: "pin_required",
      hasPin: true,
    });

    await expect(
      caller.verifyAccountSettingsPin({ pin: "2468" }),
    ).resolves.toEqual({ valid: true });
    await expect(
      caller.verifyAccountSettingsPin({ pin: "1357" }),
    ).resolves.toEqual({ valid: false });
  });

  it("rejects PIN-required settings without a PIN and preserves the existing PIN", async () => {
    const user = await createUser({
      username: "settings-pin-invariants",
      registrationRecord: "registration-record",
    });
    const caller = createAuthenticatedCaller(user.id, "pin-session");
    const settings = {
      shareMode: "pin_required" as const,
    };
    await expect(
      caller.saveAccountSettings({
        ...settings,
        pinChange: { type: "unchanged" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.saveAccountSettings({
        ...settings,
        pinChange: { type: "set", pin: "   " },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller.saveAccountSettings({
      ...settings,
      pinChange: { type: "set", pin: "2468" },
    });
    await expect(
      caller.saveAccountSettings({
        ...settings,
        pinChange: { type: "clear" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await caller.verifyAccountSettingsPin({ pin: "2468" })).toEqual({
      valid: true,
    });
    expect(await caller.accountSettings()).toMatchObject({
      hasPin: true,
      shareMode: "pin_required",
    });
    await caller.saveAccountSettings({
      ...settings,
      shareMode: "private_sync",
      pinChange: { type: "clear" },
    });
    expect(await caller.verifyAccountSettingsPin({ pin: "2468" })).toEqual({
      valid: false,
    });
  });

  it("lets server admins inspect and update account settings", async () => {
    const user = await createUser({
      username: "settings-admin-target",
      registrationRecord: "registration-record",
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: null,
      serverAdmin: {
        id: "server-admin-id",
        username: "server-admin",
      },
    });

    expect(
      await caller.adminGetUserAccountSettings({
        username: user.username,
      }),
    ).toEqual({
      shareMode: "allowed",
      hasPin: false,
    });

    await expect(
      caller.adminSaveUserAccountSettings({
        username: user.username,
        settings: {
          shareMode: "private_sync",
          pinChange: { type: "unchanged" },
        },
      }),
    ).resolves.toEqual({
      shareMode: "private_sync",
      hasPin: false,
    });
  });

  it("registers account-synced documents without creating share links", async () => {
    const user = await createUser({
      username: "account-sync-route-user",
      registrationRecord: "registration-record",
    });
    const caller = createAuthenticatedCaller(user.id, "account-sync-session");
    const { documentId } = parseAutomergeUrl(generateAutomergeUrl());
    const content = await createAutomergeContent();

    const result = await caller.registerAccountSyncedDocument({
      accountId: user.id,
      documentId,
      content,
    });

    expect(result).toEqual({
      collabDocUrl: `automerge:${documentId}`,
      accessToken: expect.any(String),
      accessTokenScope: "owner",
    });
    expect(
      await db.select().from(documents).where(eq(documents.id, documentId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(usersOnDocuments)
        .where(eq(usersOnDocuments.documentId, documentId)),
    ).toEqual([
      {
        userId: user.id,
        documentId,
        isAdmin: true,
      },
    ]);
    const tokens = await db
      .select()
      .from(documentInvitations)
      .where(eq(documentInvitations.documentId, documentId));
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      documentId,
      token: result.accessToken,
      scope: "owner",
      tag: "account-sync",
    });
  });
});

function createAuthenticatedCaller(userId: string, sessionKey: string) {
  return appRouter.createCaller({
    req: { headers: {} } as never,
    res: {} as never,
    session: {
      sessionKey,
      userId,
      createdAt: new Date(),
    },
    serverAdmin: null,
  });
}

async function createAutomergeContent(): Promise<Uint8Array> {
  const { from, save } = await import("@automerge/automerge");
  return save(from({ title: "Drawing" }));
}

async function expectPasswordLogin(username: string, password: string) {
  const caller = appRouter.createCaller({
    req: { headers: {} } as never,
    res: createHeaderRecorder() as never,
    session: null,
    serverAdmin: null,
  });
  const { clientLoginState, startLoginRequest } = opaque.client.startLogin({
    password,
  });
  const { loginResponse } = await caller.loginStart({
    userIdentifier: username,
    startLoginRequest,
  });
  const loginResult = opaque.client.finishLogin({
    clientLoginState,
    loginResponse,
    password,
  });
  if (!loginResult) {
    return false;
  }
  await caller.loginFinish({
    userIdentifier: username,
    finishLoginRequest: loginResult.finishLoginRequest,
  });
  return true;
}

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
