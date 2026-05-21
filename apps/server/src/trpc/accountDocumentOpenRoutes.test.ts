import { afterEach, describe, expect, it } from "bun:test";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { createDocument } from "../db/createDocument.js";
import { createUser } from "../db/createUser.js";
import { documentInvitations } from "../db/schema.js";
import { appRouter } from "./appRouter.js";

describe("account document open routes", () => {
  afterEach(() => {
    delete process.env.R2_PUBLIC_BASE_URL;
  });

  it("lists account collaborative document metadata without serializing document content", async () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com";
    const user = await createUser({
      username: "account-list-admin",
      registrationRecord: "registration-record",
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-list-admin-session",
        userId: user.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });
    const { document } = await caller.createDocument({
      name: "Listed Account Doc",
    });

    const result = await caller.listAccountCollaborativeDocuments();

    expect(result).toEqual([
      {
        documentId: document.id,
        name: "Listed Account Doc",
        thumbnailUrl: null,
      },
    ]);
  });

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

  it("rejects account document bootstrap when repository content is missing", async () => {
    const user = await createUser({
      username: "account-open-missing-content",
      registrationRecord: "registration-record",
    });
    await createDocument({
      userId: user.id,
      documentId: "v8W2YTz3eA7E1CmTGVmTQyPhXVA",
      name: "Missing Content Doc",
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-open-missing-content-session",
        userId: user.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    try {
      await caller.resolveAccountCollaborativeDocument({
        documentId: "v8W2YTz3eA7E1CmTGVmTQyPhXVA",
        deviceTag: "browser-device-missing-content",
      });
      throw new Error("Expected resolveAccountCollaborativeDocument to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("NOT_FOUND");
      expect((error as TRPCError).message).toBe(
        "This drawing exists in your account, but its drawing content is missing from storage.",
      );
    }
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
