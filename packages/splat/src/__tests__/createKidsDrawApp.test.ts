import { describe, expect, test } from "bun:test";
import {
  resolveAuthorizedCollaborativeDocumentId,
  resolveCollaborativeDocumentId,
  resolveInitialDocumentSize,
  resolveStartupWebsocketToken,
} from "../app/createKidsDrawApp";

describe("resolveStartupWebsocketToken", () => {
  test("prefers URL join secret", () => {
    expect(
      resolveStartupWebsocketToken("url-secret", {
        joinSecret: "stored-secret",
      }),
    ).toBe("url-secret");
  });

  test("falls back to stored document join secret", () => {
    expect(
      resolveStartupWebsocketToken(null, { joinSecret: "stored-secret" }),
    ).toBe("stored-secret");
  });

  test("returns null when neither source has a token", () => {
    expect(resolveStartupWebsocketToken(null, null)).toBeNull();
  });
});

describe("resolveInitialDocumentSize", () => {
  test("uses document size when valid", () => {
    expect(
      resolveInitialDocumentSize(
        { size: { width: 123, height: 456 } },
        { width: 10, height: 20 },
      ),
    ).toEqual({ width: 123, height: 456 });
  });

  test("falls back when document size is missing or invalid", () => {
    expect(
      resolveInitialDocumentSize(
        { size: { width: undefined, height: 456 } },
        { width: 10.2, height: 20.7 },
      ),
    ).toEqual({ width: 10, height: 21 });
  });
});

describe("resolveCollaborativeDocumentId", () => {
  test("strips automerge prefix", () => {
    expect(resolveCollaborativeDocumentId("automerge:abc123")).toBe("abc123");
  });

  test("returns raw id when no prefix is present", () => {
    expect(resolveCollaborativeDocumentId("abc123")).toBe("abc123");
  });
});

describe("resolveAuthorizedCollaborativeDocumentId", () => {
  test("returns null without websocket token", () => {
    expect(
      resolveAuthorizedCollaborativeDocumentId(null, {
        collaborative: true,
        collabDocUrl: "automerge:abc123",
      }),
    ).toBeNull();
  });

  test("returns normalized collab document id when token and collab summary exist", () => {
    expect(
      resolveAuthorizedCollaborativeDocumentId("join-secret", {
        collaborative: true,
        collabDocUrl: "automerge:abc123",
      }),
    ).toBe("abc123");
  });
});
