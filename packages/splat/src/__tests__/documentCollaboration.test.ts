import { describe, expect, test } from "bun:test";
import {
  automergeUrlToDocumentId,
  buildJoinedCatalogDocUrl,
  buildJoinUrl,
  isCollaborativeDocument,
  resolveDocumentClaimState,
  resolveDocumentOpenUrl,
  resolveJoinBaseUrl,
} from "../documents/collaboration";

describe("document collaboration helpers", () => {
  test("resolveDocumentOpenUrl uses collab url for collaborative docs", () => {
    expect(
      resolveDocumentOpenUrl("automerge:local-1", {
        docUrl: "automerge:local-1",
        collaborative: true,
        collabDocUrl: "automerge:collab-1",
        mode: "normal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      }),
    ).toBe("automerge:collab-1");
  });

  test("isCollaborativeDocument requires collaborative flag and collab url", () => {
    expect(
      isCollaborativeDocument({
        docUrl: "automerge:local-1",
        collaborative: true,
        mode: "normal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      }),
    ).toBeFalse();
    expect(
      isCollaborativeDocument({
        docUrl: "automerge:local-1",
        collaborative: true,
        collabDocUrl: "automerge:collab-1",
        mode: "normal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      }),
    ).toBeTrue();
  });

  test("automergeUrlToDocumentId parses ids from automerge urls", () => {
    expect(automergeUrlToDocumentId("automerge:doc-123")).toBe("doc-123");
    expect(automergeUrlToDocumentId("not-an-automerge-url")).toBeNull();
  });

  test("buildJoinUrl encodes join secret as query param", () => {
    expect(buildJoinUrl("abc 123", "https://splatterboard.app/draw")).toBe(
      "https://splatterboard.app/draw?join=abc+123",
    );
    expect(buildJoinUrl("next", "https://splatterboard.app/draw?foo=bar")).toBe(
      "https://splatterboard.app/draw?foo=bar&join=next",
    );
  });

  test("resolveJoinBaseUrl prefers configured value", () => {
    expect(resolveJoinBaseUrl("https://splatterboard.app/draw")).toBe(
      "https://splatterboard.app/draw",
    );
  });

  test("buildJoinedCatalogDocUrl creates stable local catalog key", () => {
    expect(buildJoinedCatalogDocUrl("automerge:doc-123")).toBe(
      "catalog-collab:doc-123",
    );
    expect(buildJoinedCatalogDocUrl("invalid-url")).toBe(
      "catalog-collab:invalid-url",
    );
    expect(buildJoinedCatalogDocUrl("weird:url/path?x=1")).toBe(
      "catalog-collab:weird%3Aurl%2Fpath%3Fx%3D1",
    );
  });

  test("resolveDocumentClaimState provides one canonical claimability decision", () => {
    const base = {
      docUrl: "automerge:local-1",
      collaborative: true,
      collabDocUrl: "automerge:collab-1",
      accessToken: "owner-token-1",
      accessTokenScope: "owner" as const,
      mode: "normal" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };

    expect(
      resolveDocumentClaimState({
        ...base,
        collaborative: false,
      }),
    ).toEqual({
      claimable: false,
      reason: "not_collaborative",
    });
    expect(
      resolveDocumentClaimState({
        ...base,
        collabDocUrl: undefined,
      }),
    ).toEqual({
      claimable: false,
      reason: "not_collaborative",
    });
    expect(
      resolveDocumentClaimState({
        ...base,
        accessToken: undefined,
      }),
    ).toEqual({
      claimable: false,
      reason: "missing_access_token",
    });
    expect(
      resolveDocumentClaimState({
        ...base,
        accessTokenScope: "device",
      }),
    ).toEqual({
      claimable: false,
      reason: "wrong_access_scope",
    });
    expect(resolveDocumentClaimState(base)).toEqual({
      claimable: true,
      accessToken: "owner-token-1",
    });
    expect(
      resolveDocumentClaimState({
        ...base,
        accountAttached: true,
      }),
    ).toEqual({
      claimable: false,
      reason: "already_attached",
    });
  });
});
