import { describe, expect, test } from "bun:test";
import {
  canCreateWebsocketAdapter,
  shouldAnnounceDocumentToServer,
} from "../documents/createLocalSmalldrawRepo";

describe("canCreateWebsocketAdapter", () => {
  test("returns false when websocket URL is missing", () => {
    expect(canCreateWebsocketAdapter(undefined, "join-secret")).toBeFalse();
  });

  test("returns false when token is missing", () => {
    expect(canCreateWebsocketAdapter("ws://localhost:3030", null)).toBeFalse();
  });

  test("returns true only when URL and token are present", () => {
    expect(
      canCreateWebsocketAdapter("ws://localhost:3030", "join-secret"),
    ).toBeTrue();
  });
});

describe("shouldAnnounceDocumentToServer", () => {
  test("allows all documents when no authorized document id is set", () => {
    expect(
      shouldAnnounceDocumentToServer({
        documentId: "doc-1",
        websocketAuthorizedDocumentId: null,
      }),
    ).toBeTrue();
  });

  test("allows only the authorized document id when scoped", () => {
    expect(
      shouldAnnounceDocumentToServer({
        documentId: "doc-1",
        websocketAuthorizedDocumentId: "doc-1",
      }),
    ).toBeTrue();
    expect(
      shouldAnnounceDocumentToServer({
        documentId: "doc-2",
        websocketAuthorizedDocumentId: "doc-1",
      }),
    ).toBeFalse();
  });
});
