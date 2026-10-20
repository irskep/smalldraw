import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { getHeads, load } from "@automerge/automerge/slim";
import type { Repo } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { MultiplayerApiClient } from "../app/createMultiplayerApiClient";
import {
  prepareAccountWorkspace,
  signOutAccountWorkspace,
  syncAccountWorkspace,
  watchAccountWorkspace,
} from "../documents/accountWorkspace";
import { createLocalSmalldrawRepo } from "../documents/createLocalSmalldrawRepo";
import { createLocalDocumentBackend } from "../documents/localDocumentBackend";
import {
  getDrawingWorkspace,
  setDrawingWorkspace,
  workspaceNames,
} from "../documents/workspace";

// Model shared/exclusive exclusion and FIFO queuing; storage and repos remain real.
function createTestLocks() {
  const tails = new Map<string, Promise<unknown>>();
  const readers = new Map<string, Promise<unknown>[]>();
  return {
    request(name: string, options: unknown, callback?: () => unknown) {
      const shared = (options as { mode?: string }).mode === "shared";
      const run = callback ?? (options as () => unknown);
      const writer = tails.get(name) ?? Promise.resolve();
      if (shared) {
        const result = writer.then(run);
        const group = readers.get(name) ?? [];
        group.push(result.catch(() => {}));
        readers.set(name, group);
        return result;
      }
      const result = Promise.all([writer, ...(readers.get(name) ?? [])]).then(
        run,
      );
      readers.delete(name);
      tails.set(
        name,
        result.catch(() => {}),
      );
      return result;
    },
  };
}

const previousIndexedDB = globalThis.indexedDB;
beforeEach(() => {
  Object.assign(globalThis, { indexedDB, IDBKeyRange });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: createTestLocks(),
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
        content: binary,
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

test("concurrent freeze requests wait for the same completed local flush", async () => {
  const { api, id } = fakeApi();
  const { repo, backend } = workspace(id);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  let freezes = 0;
  const watcher = watchAccountWorkspace({
    api,
    repo,
    backend,
    beforeFreeze: async () => {
      freezes++;
      await barrier;
    },
  });
  const first = watcher.freeze();
  const second = watcher.freeze();
  expect(first).toBe(second);
  expect(freezes).toBe(1);
  release();
  await first;
  await second;
  watcher.dispose();
});

test("logout recovery waits for another tab to flush and release its writer lease", async () => {
  const { api, id } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["saved"] });
  await backend.createDocument({ docUrl: drawing.url });
  await repo.flush();
  localStorage.setItem("drawing-account-purge", id);
  await api.signOut();
  let release!: () => void;
  let acquired!: () => void;
  const ready = new Promise<void>((resolve) => {
    acquired = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writer = navigator.locks.request(
    workspaceNames(id).lock,
    { mode: "shared" },
    async () => {
      acquired();
      await barrier;
      await repo.shutdown();
    },
  );
  await ready;
  let frozen!: () => void;
  const freezeReceived = new Promise<void>((resolve) => {
    frozen = resolve;
  });
  const bus = new BroadcastChannel("drawing-account-transition");
  bus.onmessage = (event) => {
    if (event.data?.type === "freeze" && event.data.workspace === id) frozen();
  };
  const recovery = prepareAccountWorkspace(api);
  try {
    await freezeReceived;
    expect(await backend.getDocument(drawing.url)).not.toBeNull();
    expect(localStorage.getItem("drawing-account-purge")).toBe(id);
  } finally {
    release();
    await writer;
    await recovery;
    bus.close();
  }
  expect(await backend.listDocuments()).toEqual([]);
  expect(
    await new IndexedDBStorageAdapter(workspaceNames(id).repo).loadRange([]),
  ).toEqual([]);
});

test("logout checkpoints the final edits from two open writers before purging", async () => {
  const { api, id } = fakeApi();
  const first = workspace(id);
  const second = workspace(id);
  const a = first.repo.create({ marks: ["a"] });
  const b = second.repo.create({ marks: ["b"] });
  await first.backend.createDocument({ docUrl: a.url });
  await second.backend.createDocument({ docUrl: b.url });
  await Promise.all([first.repo.flush(), second.repo.flush()]);
  const saved: unknown[] = [];
  const checkpoint = api.checkpointAccountDrawing;
  api.checkpointAccountDrawing = async (...args) => {
    saved.push(load(args[1]));
    return checkpoint(...args);
  };
  let finishSecond!: () => void;
  const barrier = new Promise<void>((resolve) => {
    finishSecond = resolve;
  });
  let freezing!: () => void;
  const started = new Promise<void>((resolve) => {
    freezing = resolve;
  });
  const one = watchAccountWorkspace({ api, ...first });
  const two = watchAccountWorkspace({
    api,
    ...second,
    beforeFreeze: async () => {
      freezing();
      await barrier;
      b.change((doc) => {
        doc.marks.push("last edit");
      });
    },
  });
  const logout = signOutAccountWorkspace(api, one.freeze);
  try {
    await started;
    expect(await api.getCurrentAccount()).not.toBeNull();
    expect(await first.backend.listDocuments()).toHaveLength(2);
    finishSecond();
    await logout;
    expect(saved).toContainEqual({ marks: ["b", "last edit"] });
    expect(await first.backend.listDocuments()).toEqual([]);
  } finally {
    finishSecond();
    await Promise.all([one.freeze(), two.freeze()]);
    one.dispose();
    two.dispose();
  }
});

test("guest catalog watcher freezes without opening an Automerge repository", async () => {
  const { api } = fakeApi();
  api.getCurrentAccount = async () => null;
  setDrawingWorkspace(null);
  let frozen = false;
  const watcher = watchAccountWorkspace({
    api,
    backend: createLocalDocumentBackend(),
    beforeFreeze: async () => {
      frozen = true;
    },
  });
  try {
    await watcher.freeze();
    expect(frozen).toBe(true);
  } finally {
    watcher.dispose();
  }
});

test("guest workspace has no polling timer and checks identity again on reconnect", async () => {
  const { api } = fakeApi();
  const { backend } = workspace(null);
  const identity = spyOn(api, "getCurrentAccount").mockResolvedValue(null);
  const intervals = spyOn(globalThis, "setInterval");
  const watcher = watchAccountWorkspace({ api, backend });
  try {
    await watcher.retry();
    expect(identity).toHaveBeenCalledTimes(1);
    expect(intervals).not.toHaveBeenCalled();
    window.dispatchEvent(new window.Event("online"));
    await watcher.retry();
    expect(identity).toHaveBeenCalledTimes(2);
  } finally {
    watcher.dispose();
    intervals.mockRestore();
  }
});

test("checkpoint traffic for an unchanged drawing across ninety seconds", async () => {
  const { api, id, checked } = fakeApi();
  const { repo, backend } = workspace(id);
  const handle = repo.create({ marks: ["first"] });
  await backend.createDocument({ docUrl: handle.url });
  const cache = new Map<string, { heads: string; at: number }>();
  const now = spyOn(Date, "now");
  try {
    for (let n = 0; n < 4; n++) {
      now.mockReturnValue(100000 + n * 31000);
      await syncAccountWorkspace(api, repo, backend, id, cache);
    }
    console.log("CHECKPOINT_IDLE_MEASUREMENT", checked.length);
    expect(checked).toHaveLength(1);
    handle.change((doc) => {
      doc.marks.push("new edit");
    });
    await syncAccountWorkspace(api, repo, backend, id, cache);
    expect(checked).toHaveLength(2);
  } finally {
    now.mockRestore();
  }
});
