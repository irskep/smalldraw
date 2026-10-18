import { afterEach, beforeEach, expect, test } from "bun:test";
import { getHeads, load } from "@automerge/automerge/slim";
import type { Repo } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { MultiplayerApiClient } from "../app/createMultiplayerApiClient";
import {
  prepareAccountWorkspace,
  signOutAccountWorkspace,
  syncAccountWorkspace,
} from "../documents/accountWorkspace";
import { createLocalSmalldrawRepo } from "../documents/createLocalSmalldrawRepo";
import { createLocalDocumentBackend } from "../documents/localDocumentBackend";
import {
  getDrawingWorkspace,
  setDrawingWorkspace,
  workspaceNames,
} from "../documents/workspace";

const previousIndexedDB = globalThis.indexedDB;
beforeEach(() => {
  Object.assign(globalThis, { indexedDB, IDBKeyRange });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        options: unknown,
        callback?: () => unknown,
      ) => {
        return await (callback ?? (options as () => unknown))();
      },
    },
  });
});
const repos: Repo[] = [];
afterEach(async () => {
  for (const repo of repos.splice(0)) await repo.shutdown();
  setDrawingWorkspace(null);
  Object.assign(globalThis, { indexedDB: previousIndexedDB });
});
function fakeApi(id = crypto.randomUUID()) {
  let signedIn = true;
  const registered: string[] = [];
  const checked: string[] = [];
  const api = {
    getCurrentAccount: async () =>
      signedIn ? { id, username: "Parent" } : null,
    listAccountCollaborativeDocuments: async () => [],
    signOut: async () => {
      signedIn = false;
    },
    registerAccountSyncedDocument: async (docUrl: string) => {
      registered.push(docUrl);
      return {
        collabDocUrl: docUrl,
        accessToken: "owner",
        accessTokenScope: "owner",
      };
    },
    checkpointAccountDrawing: async (docUrl: string, binary: Uint8Array) => {
      checked.push(docUrl);
      return {
        heads: getHeads(load(binary)),
        content: Buffer.from(binary).toString("base64"),
      };
    },
    uploadDocumentThumbnail: async () => {},
    claimCollaborativeDocument: async () => {
      throw new Error("Must not claim someone else's drawing");
    },
    acceptDocumentInvitation: async () => {},
  } as unknown as MultiplayerApiClient;
  return { api, id, registered, checked };
}
function workspace(id: string | null) {
  setDrawingWorkspace(id);
  const repo = createLocalSmalldrawRepo({ workspace: id, localOnly: true });
  repos.push(repo);
  const names = workspaceNames(id);
  const backend = createLocalDocumentBackend({
    databaseName: names.catalog,
    currentDocStorageKey: names.current,
  });
  return { repo, backend };
}

test("all drawings sync without changing the current drawing, and retry does not duplicate registration", async () => {
  const { api, id, registered, checked } = fakeApi();
  const { repo, backend } = workspace(id);
  for (const n of [1, 2, 3]) {
    const handle = repo.create({ marks: [n] });
    await backend.createDocument({ docUrl: handle.url });
  }
  const first = (await backend.listDocuments())[0].docUrl;
  await backend.setCurrentDocument(first);
  await syncAccountWorkspace(api, repo, backend, id);
  await syncAccountWorkspace(api, repo, backend, id);
  expect(registered).toHaveLength(3);
  expect(checked).toHaveLength(6);
  expect(await backend.getCurrentDocument()).toBe(first);
});

test("sign-in durably moves guest drawings into the account workspace", async () => {
  const guest = workspace(null);
  const drawing = guest.repo.create({
    marks: ["guest"],
    presentation: {
      referenceImage: {
        src: "data:image/png;base64,abc",
        composite: "over-drawing",
      },
    },
  });
  await guest.backend.createDocument({ docUrl: drawing.url });
  await guest.repo.flush();
  const { api, id } = fakeApi();
  await prepareAccountWorkspace(api);
  expect(getDrawingWorkspace()).toBe(id);
  expect(await guest.backend.getDocument(drawing.url)).toBeNull();
  const account = workspace(id);
  expect(await account.backend.getDocument(drawing.url)).not.toBeNull();
  expect((await account.repo.find(drawing.url)).doc()).toEqual(drawing.doc());
});

test("failed checkpoint blocks logout and preserves every local drawing", async () => {
  const { api, id } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["unsynced"] });
  await backend.createDocument({ docUrl: drawing.url });
  api.checkpointAccountDrawing = async () => {
    throw new Error("offline");
  };
  await expect(
    signOutAccountWorkspace(api, async () => {
      await repo.flush();
      await repo.shutdown();
    }),
  ).rejects.toThrow("offline");
  expect(await api.getCurrentAccount()).not.toBeNull();
  expect(await backend.getDocument(drawing.url)).not.toBeNull();
  expect(
    await new IndexedDBStorageAdapter(workspaceNames(id).repo).loadRange([
      drawing.documentId,
    ]),
  ).not.toHaveLength(0);
});

test("successful logout purges account content and catalog but retains the server copy", async () => {
  const { api, id, checked } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["saved"] });
  await backend.createDocument({ docUrl: drawing.url });
  await backend.setCurrentDocument(drawing.url);
  await signOutAccountWorkspace(api, async () => {
    await repo.flush();
    await repo.shutdown();
  });
  expect(checked).toEqual([drawing.url]);
  expect(await api.getCurrentAccount()).toBeNull();
  expect(await backend.listDocuments()).toEqual([]);
  expect(await backend.getCurrentDocument()).toBeNull();
  expect(
    await new IndexedDBStorageAdapter(workspaceNames(id).repo).loadRange([
      drawing.documentId,
    ]),
  ).toEqual([]);
  expect(getDrawingWorkspace()).toBeNull();
});

test("shared guest drawings retain membership without claiming ownership", async () => {
  const { api, id } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["shared"] });
  let accepted = "";
  api.acceptDocumentInvitation = async (token) => {
    accepted = token;
  };
  await backend.createDocument({
    docUrl: drawing.url,
    collabDocUrl: drawing.url,
    collaborative: true,
    joinSecret: "invitation",
    accessTokenScope: "device",
  });
  await syncAccountWorkspace(api, repo, backend, id);
  expect(accepted).toBe("invitation");
  expect(
    (await backend.getDocument(drawing.url))?.canDeleteFromServer,
  ).not.toBe(true);
});

test("reopening with a server snapshot preserves locally saved offline edits", async () => {
  const { id } = fakeApi();
  const original = workspace(id);
  const drawing = original.repo.create({
    size: { width: 100, height: 100 },
    presentation: { documentType: "normal" },
    layers: [],
    shapes: {},
    temporalOrderCounter: 0,
  });
  const serverSnapshot = await original.repo.export(drawing.url);
  drawing.change((doc) => {
    doc.temporalOrderCounter = 42;
  });
  await original.repo.flush();
  const reopened = workspace(id);
  const { createSmalldraw } = await import("@smalldraw/core");
  const core = await createSmalldraw({
    repo: reopened.repo,
    shapeHandlers: {} as never,
    preImports: [{ docId: drawing.documentId, binary: serverSnapshot! }],
    persistence: {
      mode: "reuse",
      getCurrentDocUrl: async () => drawing.url,
      setCurrentDocUrl: async () => {},
    },
  });
  expect(core.storeAdapter.getDoc().temporalOrderCounter).toBe(42);
  core.destroy();
});

test("retry after an interrupted upload reuses the registered drawing", async () => {
  const { api, id, registered } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["keep me"] });
  await backend.createDocument({ docUrl: drawing.url });
  const checkpoint = api.checkpointAccountDrawing;
  api.checkpointAccountDrawing = async () => {
    throw new Error("connection lost");
  };
  await expect(syncAccountWorkspace(api, repo, backend, id)).rejects.toThrow();
  api.checkpointAccountDrawing = checkpoint;
  await syncAccountWorkspace(api, repo, backend, id);
  expect(registered).toEqual([drawing.url]);
  expect(drawing.doc()).toEqual({ marks: ["keep me"] });
});

test("another account cannot sync or adopt an account's cached drawings", async () => {
  const accountA = fakeApi();
  const accountB = fakeApi();
  const { repo, backend } = workspace(accountA.id);
  const drawing = repo.create({ private: true });
  await backend.createDocument({ docUrl: drawing.url });
  await expect(
    syncAccountWorkspace(accountB.api, repo, backend, accountA.id),
  ).rejects.toThrow("Sign back in");
  expect(accountB.registered).toEqual([]);
  const guest = workspace(null);
  await guest.backend.createDocument({
    docUrl: drawing.url,
    collabDocUrl: drawing.url,
    collaborative: true,
    accountAttached: true,
  });
  await prepareAccountWorkspace(accountB.api);
  expect(
    await createLocalDocumentBackend().getDocument(drawing.url),
  ).toBeNull();
  setDrawingWorkspace(null);
  expect(
    await createLocalDocumentBackend().getDocument(drawing.url),
  ).toBeNull();
});

test("interrupted logout resumes purging the old account before exposing a guest gallery", async () => {
  const { api, id } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["already on server"] });
  await backend.createDocument({ docUrl: drawing.url });
  await syncAccountWorkspace(api, repo, backend, id);
  await repo.shutdown();
  localStorage.setItem("drawing-account-purge", id);
  await api.signOut();
  await prepareAccountWorkspace(api);
  expect(await backend.listDocuments()).toEqual([]);
  expect(
    await new IndexedDBStorageAdapter(workspaceNames(id).repo).loadRange([
      drawing.documentId,
    ]),
  ).toEqual([]);
  expect(localStorage.getItem("drawing-account-purge")).toBeNull();
  expect(getDrawingWorkspace()).toBeNull();
});
