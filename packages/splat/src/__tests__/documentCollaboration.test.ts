import { describe, expect, test } from "bun:test";
import {
  automergeUrlToDocumentId,
  isCollaborativeDocument,
  resolveDocumentOpenUrl,
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
});
