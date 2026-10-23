import { expect, test } from "bun:test";

import type { MultiplayerApiClient } from "../app/createMultiplayerApiClient";
import { resolveStartupPreImportsAndCurrentDocument } from "../app/documentBootstrap";
import type {
  KidsDocumentBackend,
  KidsDocumentSummary,
} from "../documents/types";

function fixture(documents: KidsDocumentSummary[]) {
  let current: string | null = null;
  const backend = {
    listDocuments: async () => documents,
    getDocument: async (key: string) =>
      documents.find((d) => d.docUrl === key) ?? null,
    setCurrentDocument: async (key: string) => {
      current = key;
    },
    createDocument: async (doc: KidsDocumentSummary) => {
      documents.push(doc);
      return doc;
    },
  } as unknown as KidsDocumentBackend;
  const options = {
    documentBackend: backend,
    multiplayerApiClient: null,
    deviceTag: "test",
    syncedAccountDocument: null,
  };
  return { options, current: () => current };
}
const summary = (
  docUrl: string,
  rest: Partial<KidsDocumentSummary> = {},
): KidsDocumentSummary => ({
  docUrl,
  mode: "normal",
  createdAt: "",
  updatedAt: "",
  lastOpenedAt: "",
  ...rest,
});

test("bare IDs select local content and joined aliases without a server", async () => {
  for (const document of [
    summary("automerge:abc"),
    summary("catalog-collab:abc", {
      collaborative: true,
      collabDocUrl: "automerge:abc",
      accessToken: "saved-token",
    }),
  ]) {
    const f = fixture([document]);
    const imports = await resolveStartupPreImportsAndCurrentDocument({
      ...f.options,
      startupIntent: { kind: "open-document", documentId: "abc" },
    });
    expect(imports).toEqual([]);
    expect(f.current()).toBe(document.docUrl);
  }
});

test("old local links never fall back to an unrelated account drawing", async () => {
  const other = summary("automerge:other");
  const f = fixture([other]);
  await expect(
    resolveStartupPreImportsAndCurrentDocument({
      ...f.options,
      syncedAccountDocument: other,
      startupIntent: {
        kind: "open-local-document",
        docUrl: "automerge:missing",
      },
    }),
  ).rejects.toThrow("not stored");
  expect(f.current()).toBeNull();
});

test("uncached bare IDs use the authenticated account resolver", async () => {
  const f = fixture([]);
  let requested = "";
  const api = {
    resolveCollaborativeDocumentByAccountDocumentId: async (id: string) => {
      requested = id;
      return {
        content: new Uint8Array([1]),
        collabDocUrl: `automerge:${id}`,
        accessToken: "account-token",
        accessTokenScope: "owner",
      };
    },
  } as unknown as MultiplayerApiClient;
  const result = await resolveStartupPreImportsAndCurrentDocument({
    ...f.options,
    multiplayerApiClient: api,
    startupIntent: { kind: "open-document", documentId: "remote" },
  });
  expect(requested).toBe("remote");
  expect(f.current()).toBe("catalog-collab:remote");
  expect(result[0].docId).toBe("automerge:remote");
});
