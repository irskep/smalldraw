import { describe, it, expect } from "bun:test";
import "../test/setup.js";
import { createUser } from "./createUser.js";
import { getUser } from "./getUser.js";
import { getUserByUsername } from "./getUserByUsername.js";
import { createSession } from "./createSession.js";
import { getSession } from "./getSession.js";
import { deleteSession } from "./deleteSession.js";
import { createDocument } from "./createDocument.js";
import { getUserHasAccessToDocument } from "./getUserHasAccessToDocument.js";

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
      })
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
      await getUserHasAccessToDocument({ userId: "", documentId: "doc" })
    ).toBe(false);
    expect(
      await getUserHasAccessToDocument({ userId: "user", documentId: "" })
    ).toBe(false);
  });
});
