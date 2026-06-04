import { describe, expect, test } from "vitest";
import { buildLauncherDocumentTiles } from "../utils/documentLauncher";

describe("document launcher", () => {
  const config = {
    drawingAppBaseUrl: "http://localhost:3000/draw/",
  };

  test("uses local catalog entries and links them as local documents", () => {
    const tiles = buildLauncherDocumentTiles({
      config,
      accountDocuments: [],
      localDocuments: [
        {
          docUrl: "automerge:local-doc",
          title: "Local sketch",
          mode: "normal",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastOpenedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(tiles).toEqual([
      {
        key: "local:automerge:local-doc",
        title: "Local sketch",
        href: "http://localhost:3000/draw/?local=automerge%3Alocal-doc",
        badge: "Local",
        thumbnailUrl: undefined,
        deleteAction: { type: "local", docUrl: "automerge:local-doc" },
      },
    ]);
  });

  test("dedupes account documents already represented by local catalog", () => {
    const tiles = buildLauncherDocumentTiles({
      config,
      accountDocuments: [
        {
          id: "shared-doc",
          name: "Server copy",
          isAdmin: true,
          thumbnailUrl: "https://example.com/server.png",
        },
      ],
      localDocuments: [
        {
          docUrl: "catalog-collab:shared-doc",
          title: "Local copy",
          collaborative: true,
          collabDocUrl: "automerge:shared-doc",
          accountAttached: true,
          canDeleteFromServer: true,
          mode: "normal",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastOpenedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({
      key: "local:catalog-collab:shared-doc",
      title: "Local copy",
      badge: "Shared",
      deleteAction: {
        type: "shared",
        documentId: "shared-doc",
        localDocUrl: "catalog-collab:shared-doc",
      },
    });
  });

  test("exposes shared removal for account attached docs without owner capability", () => {
    const tiles = buildLauncherDocumentTiles({
      config,
      accountDocuments: [],
      localDocuments: [
        {
          docUrl: "catalog-collab:member-doc",
          title: "Member copy",
          collaborative: true,
          collabDocUrl: "automerge:member-doc",
          accountAttached: true,
          mode: "normal",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastOpenedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(tiles[0]?.deleteAction).toEqual({
      type: "remove-shared",
      documentId: "member-doc",
      localDocUrl: "catalog-collab:member-doc",
    });
  });

  test("exposes shared delete for account docs with owner capability", () => {
    const tiles = buildLauncherDocumentTiles({
      config,
      localDocuments: [],
      accountDocuments: [
        {
          id: "account-doc",
          name: "Account doc",
          isAdmin: true,
          thumbnailUrl: null,
        },
      ],
    });

    expect(tiles[0]?.deleteAction).toEqual({
      type: "shared",
      documentId: "account-doc",
    });
  });

  test("exposes shared removal for account docs without owner capability", () => {
    const tiles = buildLauncherDocumentTiles({
      config,
      localDocuments: [],
      accountDocuments: [
        {
          id: "account-doc",
          name: "Account doc",
          isAdmin: false,
          thumbnailUrl: null,
        },
      ],
    });

    expect(tiles[0]?.deleteAction).toEqual({
      type: "remove-shared",
      documentId: "account-doc",
    });
  });
});
