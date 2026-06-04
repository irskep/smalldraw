import { afterEach, describe, expect, it } from "bun:test";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { createDocument } from "../db/createDocument.js";
import { createUser } from "../db/createUser.js";
import { documentInvitations, usersOnDocuments } from "../db/schema.js";
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
        isAdmin: true,
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

  it("soft deletes account documents for owner-capable users", async () => {
    const user = await createUser({
      username: "account-delete-owner",
      registrationRecord: "registration-record",
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-delete-owner-session",
        userId: user.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });
    const { document } = await caller.createDocument({
      name: "Delete Me",
    });

    const deleted = await caller.deleteDocument({ id: document.id });

    expect(deleted.id).toBe(document.id);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(await caller.documents()).toEqual([]);
    await expect(
      caller.resolveAccountCollaborativeDocument({
        documentId: document.id,
        deviceTag: "deleted-doc-device",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await caller.deletedDocuments()).toMatchObject([
      {
        id: document.id,
        name: "Delete Me",
        isAdmin: true,
      },
    ]);
  });

  it("restores account documents for owner-capable users", async () => {
    const user = await createUser({
      username: "account-restore-owner",
      registrationRecord: "registration-record",
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-restore-owner-session",
        userId: user.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });
    const { document } = await caller.createDocument({
      name: "Restore Me",
    });
    await caller.deleteDocument({ id: document.id });

    const restored = await caller.restoreDocument({ id: document.id });

    expect(restored).toEqual({ id: document.id });
    expect(await caller.deletedDocuments()).toEqual([]);
    expect(await caller.documents()).toMatchObject([
      {
        id: document.id,
        name: "Restore Me",
        isAdmin: true,
      },
    ]);
  });

  it("rejects account document deletion for non-owner members", async () => {
    const owner = await createUser({
      username: "account-delete-doc-owner",
      registrationRecord: "registration-record",
    });
    const member = await createUser({
      username: "account-delete-doc-member",
      registrationRecord: "registration-record-2",
    });
    await createDocument({
      userId: owner.id,
      documentId: "member-cannot-delete-doc",
      name: "Member Cannot Delete",
    });
    await db.insert(usersOnDocuments).values({
      userId: member.id,
      documentId: "member-cannot-delete-doc",
      isAdmin: false,
    });
    const caller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-delete-member-session",
        userId: member.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await expect(
      caller.deleteDocument({ id: "member-cannot-delete-doc" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("hides deleted documents from non-owner members and rejects their restore", async () => {
    const owner = await createUser({
      username: "account-restore-doc-owner",
      registrationRecord: "registration-record",
    });
    const member = await createUser({
      username: "account-restore-doc-member",
      registrationRecord: "registration-record-2",
    });
    await createDocument({
      userId: owner.id,
      documentId: "member-cannot-restore-doc",
      name: "Member Cannot Restore",
    });
    await db.insert(usersOnDocuments).values({
      userId: member.id,
      documentId: "member-cannot-restore-doc",
      isAdmin: false,
    });
    const ownerCaller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-restore-owner-session-2",
        userId: owner.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });
    const memberCaller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-restore-member-session",
        userId: member.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await ownerCaller.deleteDocument({ id: "member-cannot-restore-doc" });

    expect(await memberCaller.deletedDocuments()).toEqual([]);
    await expect(
      memberCaller.restoreDocument({ id: "member-cannot-restore-doc" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("removes account document listing for non-owner members", async () => {
    const owner = await createUser({
      username: "account-remove-doc-owner",
      registrationRecord: "registration-record",
    });
    const member = await createUser({
      username: "account-remove-doc-member",
      registrationRecord: "registration-record-2",
    });
    await createDocument({
      userId: owner.id,
      documentId: "member-removes-doc",
      name: "Member Removes Doc",
    });
    await db.insert(usersOnDocuments).values({
      userId: member.id,
      documentId: "member-removes-doc",
      isAdmin: false,
    });
    const memberCaller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-remove-member-session",
        userId: member.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });
    const ownerCaller = appRouter.createCaller({
      req: { headers: {} } as never,
      res: {} as never,
      session: {
        sessionKey: "account-remove-owner-session",
        userId: owner.id,
        createdAt: new Date(),
      },
      serverAdmin: null,
    });

    await expect(
      memberCaller.deleteDocument({ id: "member-removes-doc" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      memberCaller.removeDocumentFromAccount({ id: "member-removes-doc" }),
    ).resolves.toEqual({ id: "member-removes-doc" });

    expect(await memberCaller.documents()).toEqual([]);
    expect(await ownerCaller.documents()).toMatchObject([
      {
        id: "member-removes-doc",
        name: "Member Removes Doc",
        isAdmin: true,
      },
    ]);
  });
});
