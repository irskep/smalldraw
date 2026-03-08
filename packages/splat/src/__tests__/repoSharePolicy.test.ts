import { describe, expect, test } from "bun:test";
import { createServerAnnouncePolicy } from "../documents/repoSharePolicy";

describe("createServerAnnouncePolicy", () => {
  test("does not filter announcements for non-server peers", async () => {
    const policy = createServerAnnouncePolicy({
      getServerPeerId: () => "server-peer",
      isCollaborativeDocumentId: async () => false,
    });

    await expect(policy("other-peer", "doc-1")).resolves.toBeTrue();
  });

  test("filters server announcements by collaborative document id", async () => {
    const checkedIds: string[] = [];
    const policy = createServerAnnouncePolicy({
      getServerPeerId: () => "server-peer",
      isCollaborativeDocumentId: async (documentId) => {
        checkedIds.push(documentId);
        return documentId === "collab-doc";
      },
    });

    await expect(policy("server-peer", "collab-doc")).resolves.toBeTrue();
    await expect(policy("server-peer", "local-doc")).resolves.toBeFalse();
    expect(checkedIds).toEqual(["collab-doc", "local-doc"]);
  });

  test("allows announce calls without specific document id", async () => {
    const policy = createServerAnnouncePolicy({
      getServerPeerId: () => "server-peer",
      isCollaborativeDocumentId: async () => false,
    });

    await expect(policy("server-peer")).resolves.toBeTrue();
  });
});
