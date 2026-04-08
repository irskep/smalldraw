import { describe, expect, it } from "bun:test";
import * as opaque from "@serenity-kit/opaque";
import {
  buildClearedSessionCookie,
  getSessionCookieName,
} from "../auth/sessionCookie.js";
import { createSession } from "../db/createSession.js";
import { createUser } from "../db/createUser.js";
import { getUserByUsername } from "../db/getUserByUsername.js";
import { createOpaqueRegistrationRecord } from "../utils/createOpaqueRegistrationRecord.js";
import { appRouter } from "./appRouter.js";
import { createContext } from "./trpc.js";

class FakeResponse {
  private headers = new Map<string, string[]>();

  getHeader(name: string): string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  setHeader(name: string, value: number | string | readonly string[]): void {
    const normalized = Array.isArray(value) ? [...value] : [String(value)];
    this.headers.set(name.toLowerCase(), normalized);
  }
}

describe("web session cookies", () => {
  it("loginFinish sets an HttpOnly session cookie", async () => {
    await opaque.ready;
    process.env.OPAQUE_SERVER_SETUP ??= opaque.server.createSetup();

    const username = "cookie-login-user";
    const password = "cookie-password";
    const registrationRecord = await createOpaqueRegistrationRecord({
      username,
      password,
    });
    await createUser({ username, registrationRecord });

    const fakeRes = new FakeResponse();
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: fakeRes as never,
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
      password,
      clientLoginState,
      loginResponse,
    });

    expect(loginResult).not.toBeNull();
    await expect(
      caller.loginFinish({
        userIdentifier: username,
        finishLoginRequest: loginResult!.finishLoginRequest,
      }),
    ).resolves.toEqual({ success: true });

    const setCookie = fakeRes.getHeader("Set-Cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie?.[0]).toContain(`${getSessionCookieName()}=`);
    expect(setCookie?.[0]).toContain("HttpOnly");
    expect(setCookie?.[0]).toContain("SameSite=Lax");
  });

  it("createContext resolves a session from the session cookie", async () => {
    const username = "cookie-context-user";
    await createUser({
      username,
      registrationRecord: "registration-record",
    });
    const user = await getUserByUsername(username);
    expect(user).toBeTruthy();
    await createSession({
      sessionKey: "cookie-session-key",
      userId: user!.id,
    });

    const ctx = await createContext({
      req: {
        headers: {
          cookie: `${getSessionCookieName()}=cookie-session-key`,
        },
      } as never,
      res: new FakeResponse() as never,
      info: {} as never,
    });

    expect(ctx.session?.sessionKey).toBe("cookie-session-key");
    expect(ctx.session?.userId).toBe(user!.id);
  });

  it("logout clears the session cookie", async () => {
    const username = "cookie-logout-user";
    await createUser({
      username,
      registrationRecord: "registration-record",
    });
    const user = await getUserByUsername(username);
    expect(user).toBeTruthy();

    const fakeRes = new FakeResponse();
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: fakeRes as never,
      session: {
        sessionKey: "logout-session-key",
        userId: user!.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await createSession({
      sessionKey: "logout-session-key",
      userId: user!.id,
    });
    await expect(caller.logout()).resolves.toBeUndefined();

    expect(fakeRes.getHeader("Set-Cookie")).toEqual([
      buildClearedSessionCookie(),
    ]);
  });
});
