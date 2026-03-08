import { describe, expect, test } from "bun:test";
import { createCollaborativeDocumentIndex } from "../documents/collaborativeDocumentIndex";

describe("createCollaborativeDocumentIndex", () => {
  test("hydrates once and answers lookups from cached ids", async () => {
    let listCalls = 0;
    const index = createCollaborativeDocumentIndex({
      listDocuments: async () => {
        listCalls += 1;
        return [
          {
            docUrl: "automerge:local-1",
            collaborative: true,
            collabDocUrl: "automerge:collab-1",
            mode: "normal",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
          },
        ];
      },
    });

    await expect(index.hasDocumentId("collab-1")).resolves.toBeTrue();
    await expect(index.hasDocumentId("missing")).resolves.toBeFalse();
    expect(listCalls).toBe(1);
  });

  test("upsertSummary updates cached mapping without re-hydration", async () => {
    const index = createCollaborativeDocumentIndex({
      listDocuments: async () => [],
    });

    index.upsertSummary({
      docUrl: "automerge:local-2",
      collaborative: true,
      collabDocUrl: "automerge:collab-2",
      mode: "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    });

    await expect(index.hasDocumentId("collab-2")).resolves.toBeTrue();

    index.upsertSummary({
      docUrl: "automerge:local-2",
      collaborative: false,
      mode: "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    });

    await expect(index.hasDocumentId("collab-2")).resolves.toBeFalse();
  });
});
