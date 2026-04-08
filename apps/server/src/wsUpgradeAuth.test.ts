import { describe, expect, it } from "bun:test";
import { resolveWebSocketUpgradeAuth } from "./wsUpgradeAuth.js";

describe("resolveWebSocketUpgradeAuth", () => {
  it("authorizes sessionKey when token is not present", async () => {
    const auth = await resolveWebSocketUpgradeAuth({
      requestUrl: "/sync?sessionKey=session-123",
      getSessionByKey: async (sessionKey) =>
        sessionKey === "session-123" ? { userId: "user-1" } : null,
      getInvitationByToken: async () => null,
    });

    expect(auth).toEqual({
      kind: "session",
      userId: "user-1",
    });
  });

  it("authorizes token and prefers token when both are present", async () => {
    const auth = await resolveWebSocketUpgradeAuth({
      requestUrl: "/sync?sessionKey=session-123&token=join-abc",
      getSessionByKey: async () => {
        throw new Error("session lookup should not run when token is present");
      },
      getInvitationByToken: async (token) =>
        token === "join-abc"
          ? {
              id: "inv-1",
              documentId: "doc-1",
              token: "join-abc",
              scope: "device",
              tag: "device-1",
              revokedAt: null,
              lastUsedAt: new Date(),
              createdAt: new Date(),
            }
          : null,
    });

    expect(auth).toEqual({
      kind: "token",
      tokenId: "inv-1",
      documentId: "doc-1",
      scope: "device",
      tag: "device-1",
    });
  });

  it("returns null when session is missing", async () => {
    const auth = await resolveWebSocketUpgradeAuth({
      requestUrl: "/sync?sessionKey=missing",
      getSessionByKey: async () => null,
      getInvitationByToken: async () => null,
    });

    expect(auth).toBeNull();
  });

  it("returns null when token is missing", async () => {
    const auth = await resolveWebSocketUpgradeAuth({
      requestUrl: "/sync?token=missing",
      getSessionByKey: async () => null,
      getInvitationByToken: async () => null,
    });

    expect(auth).toBeNull();
  });

  it("returns null when URL has no query params", async () => {
    const auth = await resolveWebSocketUpgradeAuth({
      requestUrl: "/sync",
      getSessionByKey: async () => null,
      getInvitationByToken: async () => null,
    });

    expect(auth).toBeNull();
  });
});
