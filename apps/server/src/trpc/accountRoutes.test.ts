import { describe, expect, it } from "bun:test";
import * as opaque from "@serenity-kit/opaque";
import { TRPCError } from "@trpc/server";
import { createSession } from "../db/createSession.js";
import { createUser } from "../db/createUser.js";
import { getLoginAttempt } from "../db/getLoginAttempt.js";
import { getSession } from "../db/getSession.js";
import { getUserByUsername } from "../db/getUserByUsername.js";
import { createOpaqueRegistrationRecord } from "../utils/createOpaqueRegistrationRecord.js";
import { appRouter } from "./appRouter.js";

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
});

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
