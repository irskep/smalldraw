import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import "../test/setup.js";

describe("Test environment", () => {
  it("uses in-memory database", () => {
    expect(process.env.DATABASE_URL).toBe(":memory:");
  });
});

import { claimAnonymousCollaborativeDocument } from "./claimAnonymousCollaborativeDocument.js";
import { db } from "./client.js";
import { createAnonymousCollaborativeDocument } from "./createAnonymousCollaborativeDocument.js";
import { createDocument } from "./createDocument.js";
import { createLoginAttempt } from "./createLoginAttempt.js";
import { createOrRefreshDocumentInvitation } from "./createOrRefreshDocumentInvitation.js";
import { createSession } from "./createSession.js";
import { createUser } from "./createUser.js";
import { deleteDocument } from "./deleteDocument.js";
import { deleteSession } from "./deleteSession.js";
import { createDocumentToken } from "./documentTokens.js";
import { getDeletedDocumentsByUserId } from "./getDeletedDocumentsByUserId.js";
import { getDocument } from "./getDocument.js";
import { getDocumentInvitationByToken } from "./getDocumentInvitationByToken.js";
import { getDocumentsByUserId } from "./getDocumentsByUserId.js";
import { getDocumentThumbnail } from "./getDocumentThumbnail.js";
import { getLoginAttempt } from "./getLoginAttempt.js";
import { getSession } from "./getSession.js";
import { getUser } from "./getUser.js";
import { getUserByUsername } from "./getUserByUsername.js";
import { getUserHasAccessToDocument } from "./getUserHasAccessToDocument.js";
import { listDocumentAccessTokensForAdmin } from "./listDocumentAccessTokensForAdmin.js";
import { removeDocumentFromAccount } from "./removeDocumentFromAccount.js";
import { restoreDocument } from "./restoreDocument.js";
import { revokeDocumentAccessTokenForAdmin } from "./revokeDocumentAccessTokenForAdmin.js";
import { rotateAnonymousCollaborativeDocumentShareToken } from "./rotateAnonymousCollaborativeDocumentShareToken.js";
import {
  documentInvitations,
  loginAttempts,
  usersOnDocuments,
} from "./schema.js";
import {
  buildDocumentThumbnailStorageKey,
  buildDocumentThumbnailUrl,
} from "./thumbnailStorage.js";
import { upsertDocumentThumbnail } from "./upsertDocumentThumbnail.js";

describe("User operations", () => {
  it("createUser creates a user and returns it", async () => {
    const user = await createUser({
      username: "testuser",
      registrationRecord: "test-registration-record",
    });

    expect(user.id).toBeDefined();
    expect(user.username).toBe("testuser");
    expect(user.registrationRecord).toBe("test-registration-record");
  });

  it("getUser retrieves existing user", async () => {
    const created = await createUser({
      username: "testuser",
      registrationRecord: "test-registration-record",
    });

    const retrieved = await getUser(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.username).toBe("testuser");
  });

  it("getUser returns null for non-existent user", async () => {
    const retrieved = await getUser("non-existent-id");
    expect(retrieved).toBeNull();
  });

  it("getUserByUsername finds user by username", async () => {
    await createUser({
      username: "findme",
      registrationRecord: "test-registration-record",
    });

    const found = await getUserByUsername("findme");

    expect(found).not.toBeNull();
    expect(found!.username).toBe("findme");
  });

  it("duplicate username throws error", async () => {
    await createUser({
      username: "duplicate",
      registrationRecord: "test-registration-record",
    });

    expect(
      createUser({
        username: "duplicate",
        registrationRecord: "another-record",
      }),
    ).rejects.toThrow();
  });
});

describe("Session operations", () => {
  it("createSession creates valid session", async () => {
    const user = await createUser({
      username: "sessionuser",
      registrationRecord: "test-registration-record",
    });

    const session = await createSession({
      sessionKey: "test-session-key",
      userId: user.id,
    });

    expect(session.sessionKey).toBe("test-session-key");
    expect(session.userId).toBe(user.id);
  });

  it("getSession retrieves session", async () => {
    const user = await createUser({
      username: "sessionuser",
      registrationRecord: "test-registration-record",
    });

    await createSession({
      sessionKey: "test-session-key",
      userId: user.id,
    });

    const retrieved = await getSession("test-session-key");

    expect(retrieved).not.toBeNull();
    expect(retrieved!.sessionKey).toBe("test-session-key");
    expect(retrieved!.userId).toBe(user.id);
  });

  it("getSession returns null for non-existent session", async () => {
    const retrieved = await getSession("non-existent-key");
    expect(retrieved).toBeNull();
  });

  it("deleteSession removes session", async () => {
    const user = await createUser({
      username: "sessionuser",
      registrationRecord: "test-registration-record",
    });

    await createSession({
      sessionKey: "to-delete",
      userId: user.id,
    });

    await deleteSession("to-delete");

    const retrieved = await getSession("to-delete");
    expect(retrieved).toBeNull();
  });
});

describe("Login attempt operations", () => {
  it("returns active login attempts", async () => {
    const user = await createUser({
      username: "login-attempt-user",
      registrationRecord: "test-registration-record",
    });

    await createLoginAttempt({
      userId: user.id,
      serverLoginState: "active-attempt",
    });

    await expect(getLoginAttempt("login-attempt-user")).resolves.toMatchObject({
      userId: user.id,
      serverLoginState: "active-attempt",
    });
  });

  it("refreshes an existing login attempt instead of stranding the user", async () => {
    const user = await createUser({
      username: "login-attempt-refresh",
      registrationRecord: "test-registration-record",
    });

    await createLoginAttempt({
      userId: user.id,
      serverLoginState: "first-attempt",
    });
    await createLoginAttempt({
      userId: user.id,
      serverLoginState: "second-attempt",
    });

    const attempts = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.userId, user.id));

    expect(attempts).toHaveLength(1);
    expect(attempts[0].serverLoginState).toBe("second-attempt");
  });

  it("ignores stale login attempts so interrupted flows can retry", async () => {
    const user = await createUser({
      username: "stale-login-attempt",
      registrationRecord: "test-registration-record",
    });

    await createLoginAttempt({
      userId: user.id,
      serverLoginState: "stale-attempt",
    });
    await db
      .update(loginAttempts)
      .set({ createdAt: new Date(Date.now() - 9_000) })
      .where(eq(loginAttempts.userId, user.id));

    await expect(getLoginAttempt("stale-login-attempt")).resolves.toBeNull();
  });
});

describe("Document operations", () => {
  it("createDocument creates document with owner", async () => {
    const user = await createUser({
      username: "docowner",
      registrationRecord: "test-registration-record",
    });

    const doc = await createDocument({
      userId: user.id,
      documentId: "test-doc-id",
      name: "Test Document",
    });

    expect(doc.id).toBe("test-doc-id");
    expect(doc.name).toBe("Test Document");

    // Verify user has access
    const hasAccess = await getUserHasAccessToDocument({
      userId: user.id,
      documentId: "test-doc-id",
    });
    expect(hasAccess).toBe(true);
  });

  it("createDocument uses default name when not provided", async () => {
    const user = await createUser({
      username: "docowner",
      registrationRecord: "test-registration-record",
    });

    const doc = await createDocument({
      userId: user.id,
      documentId: "test-doc-id",
    });

    expect(doc.name).toBe("Untitled");
  });

  it("getUserHasAccessToDocument returns false for non-member", async () => {
    const owner = await createUser({
      username: "owner",
      registrationRecord: "test-registration-record",
    });
    const other = await createUser({
      username: "other",
      registrationRecord: "test-registration-record-2",
    });

    await createDocument({
      userId: owner.id,
      documentId: "private-doc",
      name: "Private",
    });

    const hasAccess = await getUserHasAccessToDocument({
      userId: other.id,
      documentId: "private-doc",
    });
    expect(hasAccess).toBe(false);
  });

  it("getUserHasAccessToDocument returns false for invalid inputs", async () => {
    expect(
      await getUserHasAccessToDocument({ userId: "", documentId: "doc" }),
    ).toBe(false);
    expect(
      await getUserHasAccessToDocument({ userId: "user", documentId: "" }),
    ).toBe(false);
  });

  it("deleteDocument soft deletes owner-capable documents", async () => {
    const user = await createUser({
      username: "delete-owner",
      registrationRecord: "test-registration-record",
    });
    await createDocument({
      userId: user.id,
      documentId: "delete-doc",
      name: "Delete Doc",
    });

    const deleted = await deleteDocument({
      userId: user.id,
      documentId: "delete-doc",
    });

    expect(deleted.id).toBe("delete-doc");
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(await getDocumentsByUserId(user.id)).toEqual([]);
    expect(
      await getDocument({ userId: user.id, documentId: "delete-doc" }),
    ).toBeNull();
    expect(
      await getUserHasAccessToDocument({
        userId: user.id,
        documentId: "delete-doc",
      }),
    ).toBe(false);
  });

  it("deleteDocument distinguishes missing docs from permission failures", async () => {
    const owner = await createUser({
      username: "delete-permission-owner",
      registrationRecord: "test-registration-record",
    });
    const member = await createUser({
      username: "delete-permission-member",
      registrationRecord: "test-registration-record-2",
    });
    await createDocument({
      userId: owner.id,
      documentId: "delete-permission-doc",
      name: "Delete Permission Doc",
    });
    await db.insert(usersOnDocuments).values({
      userId: member.id,
      documentId: "delete-permission-doc",
      isAdmin: false,
    });

    await expect(
      deleteDocument({
        userId: member.id,
        documentId: "delete-permission-doc",
      }),
    ).rejects.toThrow("User lacks delete permission");
    await expect(
      deleteDocument({
        userId: owner.id,
        documentId: "missing-delete-doc",
      }),
    ).rejects.toThrow("Document not found");
  });

  it("getDeletedDocumentsByUserId returns only owner-capable deleted documents", async () => {
    const owner = await createUser({
      username: "deleted-list-owner",
      registrationRecord: "test-registration-record",
    });
    const member = await createUser({
      username: "deleted-list-member",
      registrationRecord: "test-registration-record-2",
    });
    await createDocument({
      userId: owner.id,
      documentId: "deleted-list-doc",
      name: "Deleted List Doc",
    });
    await db.insert(usersOnDocuments).values({
      userId: member.id,
      documentId: "deleted-list-doc",
      isAdmin: false,
    });

    await deleteDocument({
      userId: owner.id,
      documentId: "deleted-list-doc",
    });

    const ownerDeleted = await getDeletedDocumentsByUserId(owner.id);
    const memberDeleted = await getDeletedDocumentsByUserId(member.id);

    expect(ownerDeleted).toHaveLength(1);
    expect(ownerDeleted[0]).toMatchObject({
      id: "deleted-list-doc",
      name: "Deleted List Doc",
      isAdmin: true,
    });
    expect(ownerDeleted[0].deletedAt).toBeInstanceOf(Date);
    expect(memberDeleted).toEqual([]);
  });

  it("restoreDocument restores owner-capable deleted documents", async () => {
    const user = await createUser({
      username: "restore-owner",
      registrationRecord: "test-registration-record",
    });
    await createDocument({
      userId: user.id,
      documentId: "restore-doc",
      name: "Restore Doc",
    });
    await deleteDocument({
      userId: user.id,
      documentId: "restore-doc",
    });

    const restored = await restoreDocument({
      userId: user.id,
      documentId: "restore-doc",
    });

    expect(restored).toEqual({ id: "restore-doc" });
    expect(await getDeletedDocumentsByUserId(user.id)).toEqual([]);
    expect(await getDocumentsByUserId(user.id)).toMatchObject([
      {
        id: "restore-doc",
        name: "Restore Doc",
        isAdmin: true,
      },
    ]);
  });

  it("restoreDocument distinguishes missing docs from permission failures", async () => {
    const owner = await createUser({
      username: "restore-permission-owner",
      registrationRecord: "test-registration-record",
    });
    const member = await createUser({
      username: "restore-permission-member",
      registrationRecord: "test-registration-record-2",
    });
    await createDocument({
      userId: owner.id,
      documentId: "restore-permission-doc",
      name: "Restore Permission Doc",
    });
    await db.insert(usersOnDocuments).values({
      userId: member.id,
      documentId: "restore-permission-doc",
      isAdmin: false,
    });
    await deleteDocument({
      userId: owner.id,
      documentId: "restore-permission-doc",
    });

    await expect(
      restoreDocument({
        userId: member.id,
        documentId: "restore-permission-doc",
      }),
    ).rejects.toThrow("User lacks restore permission");
    await expect(
      restoreDocument({
        userId: owner.id,
        documentId: "missing-restore-doc",
      }),
    ).rejects.toThrow("Document not found");
  });

  it("removeDocumentFromAccount removes membership without deleting the document", async () => {
    const owner = await createUser({
      username: "remove-membership-owner",
      registrationRecord: "test-registration-record",
    });
    const member = await createUser({
      username: "remove-membership-member",
      registrationRecord: "test-registration-record-2",
    });
    await createDocument({
      userId: owner.id,
      documentId: "remove-membership-doc",
      name: "Remove Membership Doc",
    });
    await db.insert(usersOnDocuments).values({
      userId: member.id,
      documentId: "remove-membership-doc",
      isAdmin: false,
    });

    const removed = await removeDocumentFromAccount({
      userId: member.id,
      documentId: "remove-membership-doc",
    });

    expect(removed).toEqual({ id: "remove-membership-doc" });
    expect(await getDocumentsByUserId(member.id)).toEqual([]);
    expect(
      await getDocument({
        userId: owner.id,
        documentId: "remove-membership-doc",
      }),
    ).not.toBeNull();
  });

  it("removeDocumentFromAccount reports missing memberships as missing documents", async () => {
    const user = await createUser({
      username: "remove-membership-missing",
      registrationRecord: "test-registration-record",
    });

    await expect(
      removeDocumentFromAccount({
        userId: user.id,
        documentId: "missing-membership-doc",
      }),
    ).rejects.toThrow("Document not found");
  });

  it("getDocumentInvitationByToken returns invitation by token", async () => {
    const user = await createUser({
      username: "owner-for-token",
      registrationRecord: "test-registration-record",
    });
    const doc = await createDocument({
      userId: user.id,
      documentId: "doc-with-invite",
      name: "Invitation Doc",
    });

    const invitation = await createOrRefreshDocumentInvitation({
      userId: user.id,
      documentId: doc.id,
    });
    expect(invitation).not.toBeNull();

    const fetched = await getDocumentInvitationByToken(invitation!.token);
    expect(fetched).not.toBeNull();
    expect(fetched!.documentId).toBe(doc.id);
    expect(fetched!.token).toBe(invitation!.token);
  });

  it("getDocumentInvitationByToken returns null for unknown token", async () => {
    const invitation = await getDocumentInvitationByToken("missing-token");
    expect(invitation).toBeNull();
  });

  it("createAnonymousCollaborativeDocument creates doc and join secret without membership", async () => {
    const result = await createAnonymousCollaborativeDocument({
      documentId: "anon-doc-1",
      ownerTag: "creator-device-1",
    });

    expect(result.document.id).toBe("anon-doc-1");
    expect(result.document.name).toBe("Untitled");
    expect(result.joinSecret.length).toBeGreaterThan(0);
    expect(result.accessToken.length).toBeGreaterThan(0);

    const invitation = await getDocumentInvitationByToken(result.joinSecret, {
      scopes: ["share"],
    });
    expect(invitation).not.toBeNull();
    expect(invitation!.documentId).toBe("anon-doc-1");
    expect(invitation!.scope).toBe("share");

    const ownerToken = await getDocumentInvitationByToken(result.accessToken, {
      scopes: ["owner"],
    });
    expect(ownerToken).not.toBeNull();
    expect(ownerToken!.tag).toBe("creator-device-1");

    const memberships = await db
      .select()
      .from(usersOnDocuments)
      .where(eq(usersOnDocuments.documentId, "anon-doc-1"));
    expect(memberships).toHaveLength(0);
  });

  it("listDocumentAccessTokensForAdmin returns owner and device tokens but not share tokens", async () => {
    const user = await createUser({
      username: "doc-admin",
      registrationRecord: "test-registration-record",
    });
    const doc = await createDocument({
      userId: user.id,
      documentId: "token-doc",
      name: "Token Doc",
    });

    await createDocumentToken({
      documentId: doc.id,
      scope: "owner",
      tag: "owner-device",
    });
    await createDocumentToken({
      documentId: doc.id,
      scope: "device",
      tag: "joiner-ipad",
    });

    const tokens = await listDocumentAccessTokensForAdmin({
      userId: user.id,
      documentId: doc.id,
    });

    expect(tokens.map((token) => token.scope).sort()).toEqual([
      "device",
      "owner",
    ]);
    expect(tokens.find((token) => token.scope === "device")?.tag).toBe(
      "joiner-ipad",
    );
  });

  it("revokeDocumentAccessTokenForAdmin revokes only device tokens", async () => {
    const user = await createUser({
      username: "doc-admin-2",
      registrationRecord: "test-registration-record",
    });
    const doc = await createDocument({
      userId: user.id,
      documentId: "token-doc-2",
      name: "Token Doc 2",
    });
    const deviceToken = await createDocumentToken({
      documentId: doc.id,
      scope: "device",
      tag: "joiner-phone",
    });
    const ownerToken = await createDocumentToken({
      documentId: doc.id,
      scope: "owner",
      tag: "owner-laptop",
    });

    expect(
      await revokeDocumentAccessTokenForAdmin({
        userId: user.id,
        documentId: doc.id,
        tokenId: deviceToken.id,
      }),
    ).toBe(true);
    expect(
      (
        await getDocumentInvitationByToken(deviceToken.token, {
          scopes: ["device"],
        })
      )?.revokedAt,
    ).not.toBeNull();

    expect(
      await revokeDocumentAccessTokenForAdmin({
        userId: user.id,
        documentId: doc.id,
        tokenId: ownerToken.id,
      }),
    ).toBe(false);
  });

  it("rotateAnonymousCollaborativeDocumentShareToken revokes prior share token and returns a new one", async () => {
    const created = await createAnonymousCollaborativeDocument({
      documentId: "anon-doc-rotate",
      ownerTag: "creator-device-rotate",
    });

    const firstShare = await getDocumentInvitationByToken(created.joinSecret, {
      scopes: ["share"],
    });
    expect(firstShare).not.toBeNull();

    const rotated =
      await rotateAnonymousCollaborativeDocumentShareToken("anon-doc-rotate");

    expect(rotated.token).not.toBe(created.joinSecret);

    const oldShareAfterRotate = await db
      .select()
      .from(documentInvitations)
      .where(eq(documentInvitations.id, firstShare!.id))
      .limit(1);
    expect(oldShareAfterRotate[0]?.revokedAt).not.toBeNull();

    const activeShare = await getDocumentInvitationByToken(rotated.token, {
      scopes: ["share"],
    });
    expect(activeShare?.documentId).toBe("anon-doc-rotate");
  });

  it("claimAnonymousCollaborativeDocument attaches owner to account as admin", async () => {
    const owner = await createUser({
      username: "owner-claimer",
      registrationRecord: "test-registration-record",
    });
    const created = await createAnonymousCollaborativeDocument({
      documentId: "anon-doc-claim",
      ownerTag: "creator-device-claim",
    });

    const claimed = await claimAnonymousCollaborativeDocument({
      userId: owner.id,
      accessToken: created.accessToken,
    });

    expect(claimed).toEqual({
      documentId: "anon-doc-claim",
      attached: true,
      isAdmin: true,
    });

    const memberships = await db
      .select()
      .from(usersOnDocuments)
      .where(eq(usersOnDocuments.documentId, "anon-doc-claim"));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      userId: owner.id,
      documentId: "anon-doc-claim",
      isAdmin: true,
    });
  });

  it("claimAnonymousCollaborativeDocument upgrades existing non-admin membership", async () => {
    const owner = await createUser({
      username: "owner-upgrader",
      registrationRecord: "test-registration-record",
    });
    const collaborator = await createUser({
      username: "collaborator-upgrader",
      registrationRecord: "test-registration-record-2",
    });
    const created = await createAnonymousCollaborativeDocument({
      documentId: "anon-doc-upgrade",
      ownerTag: "creator-device-upgrade",
    });

    await db.insert(usersOnDocuments).values({
      userId: collaborator.id,
      documentId: "anon-doc-upgrade",
      isAdmin: false,
    });

    const claimed = await claimAnonymousCollaborativeDocument({
      userId: collaborator.id,
      accessToken: created.accessToken,
    });

    expect(claimed).toEqual({
      documentId: "anon-doc-upgrade",
      attached: false,
      isAdmin: true,
    });

    const [membership] = await db
      .select()
      .from(usersOnDocuments)
      .where(
        and(
          eq(usersOnDocuments.userId, collaborator.id),
          eq(usersOnDocuments.documentId, "anon-doc-upgrade"),
        ),
      )
      .limit(1);
    expect(membership?.isAdmin).toBe(true);

    const ownerToken = await getDocumentInvitationByToken(created.accessToken, {
      scopes: ["owner"],
    });
    expect(ownerToken?.tag).toBe("creator-device-upgrade");
    expect(owner.id).not.toBe(collaborator.id);
  });

  it("claimAnonymousCollaborativeDocument rejects non-owner tokens", async () => {
    const user = await createUser({
      username: "invalid-claimer",
      registrationRecord: "test-registration-record",
    });
    const created = await createAnonymousCollaborativeDocument({
      documentId: "anon-doc-invalid-claim",
      ownerTag: "creator-device-invalid",
    });

    await expect(
      claimAnonymousCollaborativeDocument({
        userId: user.id,
        accessToken: created.joinSecret,
      }),
    ).rejects.toThrow("Owner token not found");
  });

  it("upsertDocumentThumbnail creates and updates thumbnail metadata", async () => {
    const user = await createUser({
      username: "thumb-owner",
      registrationRecord: "test-registration-record",
    });
    await createDocument({
      userId: user.id,
      documentId: "thumb-doc-1",
      name: "Thumb Doc",
    });

    const first = await upsertDocumentThumbnail({
      documentId: "thumb-doc-1",
      storageKey: buildDocumentThumbnailStorageKey("thumb-doc-1"),
      contentType: "image/png",
    });
    expect(first?.documentId).toBe("thumb-doc-1");
    expect(first?.storageKey).toBe("documents/thumb-doc-1/thumbnail.png");
    expect(first?.contentType).toBe("image/png");

    const second = await upsertDocumentThumbnail({
      documentId: "thumb-doc-1",
      storageKey: "documents/thumb-doc-1/thumbnail.webp",
      contentType: "image/webp",
    });
    expect(second?.storageKey).toBe("documents/thumb-doc-1/thumbnail.webp");
    expect(second?.contentType).toBe("image/webp");

    const fetched = await getDocumentThumbnail("thumb-doc-1");
    expect(fetched?.storageKey).toBe("documents/thumb-doc-1/thumbnail.webp");
  });

  it("getDocumentsByUserId returns thumbnail metadata when present", async () => {
    const user = await createUser({
      username: "thumb-list-owner",
      registrationRecord: "test-registration-record",
    });
    await createDocument({
      userId: user.id,
      documentId: "thumb-doc-2",
      name: "Thumb List Doc",
    });
    await upsertDocumentThumbnail({
      documentId: "thumb-doc-2",
      storageKey: buildDocumentThumbnailStorageKey("thumb-doc-2"),
      contentType: "image/png",
    });

    const documents = await getDocumentsByUserId(user.id);
    expect(documents).toEqual([
      {
        id: "thumb-doc-2",
        name: "Thumb List Doc",
        isAdmin: true,
        thumbnailStorageKey: "documents/thumb-doc-2/thumbnail.png",
        thumbnailContentType: "image/png",
      },
    ]);
  });

  it("buildDocumentThumbnailUrl joins public base url and storage key", () => {
    expect(
      buildDocumentThumbnailUrl(
        "documents/thumb-doc-3/thumbnail.png",
        "https://cdn.example.com",
      ),
    ).toBe("https://cdn.example.com/documents/thumb-doc-3/thumbnail.png");
    expect(
      buildDocumentThumbnailUrl(
        "/documents/thumb-doc-3/thumbnail.png",
        "https://cdn.example.com/",
      ),
    ).toBe("https://cdn.example.com/documents/thumb-doc-3/thumbnail.png");
    expect(
      buildDocumentThumbnailUrl(
        "documents/thumb-doc-3/thumbnail.png",
        undefined,
      ),
    ).toBeNull();
  });
});
