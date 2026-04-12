import { describe, expect, it } from "bun:test";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { createDocument } from "../db/createDocument.js";
import { createUser } from "../db/createUser.js";
import { documentInvitations } from "../db/schema.js";
import { appRouter } from "./appRouter.js";

describe("account document open routes", () => {
  it("returns an owner-scoped bootstrap payload for account document admins", async () => {
    const user = await createUser({
      username: "account-open-admin",
      registrationRecord: "registration-record",
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-open-admin-session",
        userId: user.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });
    const { document } = await caller.createDocument({
      name: "Account Open Doc",
    });

    const result = await caller.resolveAccountCollaborativeDocument({
      documentId: document.id,
      deviceTag: "browser-device-1",
    });

    expect(result.collabDocUrl).toBe(`automerge:${document.id}`);
    expect(result.accessToken).toBeTruthy();
    expect(result.accessTokenScope).toBe("owner");
    expect(result.content).toBeTruthy();

    const tokens = await db
      .select()
      .from(documentInvitations)
      .where(eq(documentInvitations.token, result.accessToken));
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      documentId: document.id,
      token: result.accessToken,
      scope: "owner",
      tag: `account:${user.id}:device:browser-device-1`,
    });
  });

  it("rejects account document bootstrap for non-members", async () => {
    const owner = await createUser({
      username: "account-open-owner",
      registrationRecord: "registration-record",
    });
    const outsider = await createUser({
      username: "account-open-outsider",
      registrationRecord: "registration-record-2",
    });
    await createDocument({
      userId: owner.id,
      documentId: "account-open-private-doc",
      name: "Private Doc",
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-open-outsider-session",
        userId: outsider.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await expect(
      caller.resolveAccountCollaborativeDocument({
        documentId: "account-open-private-doc",
        deviceTag: "browser-device-2",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
