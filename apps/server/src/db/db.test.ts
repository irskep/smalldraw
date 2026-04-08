import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import "../test/setup.js";

describe("Test environment", () => {
  it("uses in-memory database", () => {
    expect(process.env.DATABASE_URL).toBe(":memory:");
  });
});

import { db } from "./client.js";
import { createAnonymousCollaborativeDocument } from "./createAnonymousCollaborativeDocument.js";
import { createDocument } from "./createDocument.js";
import { createOrRefreshDocumentInvitation } from "./createOrRefreshDocumentInvitation.js";
import { createSession } from "./createSession.js";
import { createUser } from "./createUser.js";
import { deleteSession } from "./deleteSession.js";
import { createDocumentToken } from "./documentTokens.js";
import { getDocumentInvitationByToken } from "./getDocumentInvitationByToken.js";
import { getSession } from "./getSession.js";
import { getUser } from "./getUser.js";
import { getUserByUsername } from "./getUserByUsername.js";
import { getUserHasAccessToDocument } from "./getUserHasAccessToDocument.js";
import { listDocumentAccessTokensForAdmin } from "./listDocumentAccessTokensForAdmin.js";
import { revokeDocumentAccessTokenForAdmin } from "./revokeDocumentAccessTokenForAdmin.js";
import { usersOnDocuments } from "./schema.js";

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
});
