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
    });
  });
});
