import { describe, expect, it } from "bun:test";
import { isValidAwarenessPayloadForAuth } from "./awarenessValidation.js";

describe("isValidAwarenessPayloadForAuth", () => {
  it("requires awareness type for all auth contexts", () => {
    const allowed = isValidAwarenessPayloadForAuth(
      {
        kind: "token",
        documentId: "doc-1",
      },
      { type: "not-awareness" },
    );

    expect(allowed).toBe(false);
  });

  it("allows anonymous token-auth awareness payloads", () => {
    const allowed = isValidAwarenessPayloadForAuth(
      {
        kind: "token",
        documentId: "doc-1",
      },
      { type: "awareness" },
    );

    expect(allowed).toBe(true);
  });

  it("requires userId match for session-auth awareness payloads", () => {
    const matching = isValidAwarenessPayloadForAuth(
      {
        kind: "session",
        userId: "user-1",
      },
      { type: "awareness", userId: "user-1" },
    );
    const notMatching = isValidAwarenessPayloadForAuth(
      {
        kind: "session",
        userId: "user-1",
      },
      { type: "awareness", userId: "user-2" },
    );

    expect(matching).toBe(true);
    expect(notMatching).toBe(false);
  });
});
