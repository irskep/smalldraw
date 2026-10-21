import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import type { Repo } from "@automerge/automerge-repo/slim";
import {
  free,
  getHeads,
  hasHeads,
  init,
  load,
  loadIncremental,
  merge,
  save,
  saveSince,
} from "@automerge/automerge/slim";
import type { DrawingCheckpoint } from "@smalldraw/shared";
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
  const server = new Map<string, Uint8Array>();
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
    checkpointAccountDrawing: async (
      docUrl: string,
      input: DrawingCheckpoint,
    ) => {
      checked.push(docUrl);
      let doc = server.has(docUrl) ? load(server.get(docUrl)!) : init();
      try {
        if (input.baseHeads !== null && !hasHeads(doc, input.baseHeads))
          return { status: "resync" };
        if (input.baseHeads === null) {
          const incoming = load(input.content);
          try {
            doc = merge(doc, incoming);
          } finally {
            free(incoming);
          }
        } else {
          doc = loadIncremental(doc, input.content);
        }
        server.set(docUrl, save(doc));
        return {
          status: "saved",
          heads: getHeads(doc),
          content: saveSince(doc, input.heads),
        };
      } finally {
        free(doc);
      }
    },
    uploadDocumentThumbnail: async () => {},
    claimCollaborativeDocument: async () => {
      throw new Error("Must not claim someone else's drawing");
    },
    acceptDocumentInvitation: async () => {},
  } as unknown as MultiplayerApiClient;
  return { api, id, registered, checked, server };
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
  expect(checked).toHaveLength(3);
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
  const { api, id, server } = fakeApi();
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
    const result = await checkpoint(...args);
    saved.push(load(server.get(args[0])!));
    return result;
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
  const now = spyOn(Date, "now");
  try {
    for (let n = 0; n < 4; n++) {
      now.mockReturnValue(100000 + n * 31000);
      await syncAccountWorkspace(api, repo, backend, id);
    }
    console.log("CHECKPOINT_IDLE_MEASUREMENT", checked.length);
    expect(checked).toHaveLength(1);
    handle.change((doc) => {
      doc.marks.push("new edit");
    });
    await syncAccountWorkspace(api, repo, backend, id);
    expect(checked).toHaveLength(2);
  } finally {
    now.mockRestore();
  }
});

test("incremental checkpoints survive a lost reply, resync, and edits made during upload", async () => {
  const { api, id, server } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["base"] });
  await backend.createDocument({ docUrl: drawing.url });
  await syncAccountWorkspace(api, repo, backend, id);
  const original = api.checkpointAccountDrawing;
  const sent: DrawingCheckpoint[] = [];
  let loseReply = true;
  api.checkpointAccountDrawing = async (...args) => {
    sent.push(args[1]);
    const result = await original(...args);
    if (loseReply) {
      loseReply = false;
      throw Error("reply lost after saving");
    }
    return result;
  };
  drawing.change((d) => {
    d.marks.push("first edit");
  });
  await expect(syncAccountWorkspace(api, repo, backend, id)).rejects.toThrow(
    "reply lost",
  );
  drawing.change((d) => {
    d.marks.push("second edit");
  });
  await syncAccountWorkspace(api, repo, backend, id);
  expect(sent.every((x) => x.baseHeads !== null)).toBe(true);
  expect(load<{ marks: string[] }>(server.get(drawing.url)!).marks).toEqual([
    "base",
    "first edit",
    "second edit",
  ]);
  let edited = false;
  api.checkpointAccountDrawing = async (...args) => {
    const result = await original(...args);
    if (!edited) {
      edited = true;
      drawing.change((d) => {
        d.marks.push("during upload");
      });
    }
    return result;
  };
  drawing.change((d) => {
    d.marks.push("before upload");
  });
  await syncAccountWorkspace(api, repo, backend, id);
  expect(drawing.doc().marks).toContain("during upload");
  expect(
    load<{ marks: string[] }>(server.get(drawing.url)!).marks,
  ).not.toContain("during upload");
  await syncAccountWorkspace(api, repo, backend, id);
  expect(load<{ marks: string[] }>(server.get(drawing.url)!).marks).toContain(
    "during upload",
  );
  // Simulate the server losing its base history. A bounded full retry restores it.
  server.clear();
  sent.length = 0;
  api.checkpointAccountDrawing = async (...args) => {
    sent.push(args[1]);
    return original(...args);
  };
  drawing.change((d) => {
    d.marks.push("after recovery");
  });
  await syncAccountWorkspace(api, repo, backend, id);
  expect(sent.map((x) => x.baseHeads === null)).toEqual([false, true]);
  expect(load<{ marks: string[] }>(server.get(drawing.url)!).marks).toEqual(
    drawing.doc().marks,
  );
});

test("a reply that omits uploaded edits cannot advance the checkpoint", async () => {
  const { api, id } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["base"] });
  await backend.createDocument({ docUrl: drawing.url });
  await syncAccountWorkspace(api, repo, backend, id);
  const previous = (await backend.getDocument(drawing.url))!.accountCheckpoint!;
  drawing.change((d) => {
    d.marks.push("must be saved");
  });
  api.checkpointAccountDrawing = async () => ({
    status: "saved",
    heads: previous.heads,
    content: new Uint8Array(),
  });
  await expect(syncAccountWorkspace(api, repo, backend, id)).rejects.toThrow(
    "not saved every change",
  );
  expect((await backend.getDocument(drawing.url))!.accountCheckpoint).toEqual(
    previous,
  );
  expect(drawing.doc().marks).toContain("must be saved");
});

test("an unrelated unloaded handle cannot block account checkpoints", async () => {
  const { api, id, checked } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["keep"] });
  await backend.createDocument({ docUrl: drawing.url });
  const unrelated = repo.create({ unused: true });
  await repo.flush();
  unrelated.unload();
  try {
    await expect(repo.flush()).rejects.toThrow("DocHandle is not ready");
    await syncAccountWorkspace(api, repo, backend, id);
    expect(checked).toEqual([drawing.url]);
  } finally {
    repo.delete(unrelated.documentId);
  }
});

test("checkpoint progress survives a new repo and backend; unchanged reload sends nothing", async () => {
  const { api, id } = fakeApi();
  const first = workspace(id);
  const drawing = first.repo.create({ marks: ["original"] });
  await first.backend.createDocument({ docUrl: drawing.url });
  const checkpoint = spyOn(api, "checkpointAccountDrawing");
  await syncAccountWorkspace(api, first.repo, first.backend, id);
  const original = await first.backend.getDocument(drawing.url);
  await first.repo.shutdown();
  repos.splice(repos.indexOf(first.repo), 1);
  const second = workspace(id);
  await syncAccountWorkspace(api, second.repo, second.backend, id);
  expect(checkpoint).toHaveBeenCalledTimes(1);
  const reopened = await second.repo.find<{ marks: string[] }>(drawing.url);
  reopened.change((doc) => {
    doc.marks.push("after reload");
  });
  await syncAccountWorkspace(api, second.repo, second.backend, id);
  expect(checkpoint).toHaveBeenCalledTimes(2);
  expect(checkpoint.mock.calls[1][1].baseHeads).toEqual(
    original!.accountCheckpoint!.heads,
  );
  // Saving checkpoint progress must not reorder the gallery.
  expect((await second.backend.getDocument(drawing.url))!.lastOpenedAt).toBe(
    original!.lastOpenedAt,
  );
  console.log("CHECKPOINT_RELOAD_MEASUREMENT", {
    bootstrap: 1,
    unchangedReload: 0,
    editedReload: "incremental",
  });
});

test("failed checkpoint metadata persistence does not lose edits or falsely mark them saved", async () => {
  const { api, id, server } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["original"] });
  await backend.createDocument({ docUrl: drawing.url });
  await syncAccountWorkspace(api, repo, backend, id);
  const previous = (await backend.getDocument(drawing.url))!.accountCheckpoint;
  drawing.change((doc) => {
    doc.marks.push("new");
  });
  const write = spyOn(backend, "saveAccountCheckpoint").mockRejectedValueOnce(
    new Error("quota"),
  );
  await expect(syncAccountWorkspace(api, repo, backend, id)).rejects.toThrow(
    "quota",
  );
  expect((await backend.getDocument(drawing.url))!.accountCheckpoint).toEqual(
    previous,
  );
  write.mockRestore();
  await syncAccountWorkspace(api, repo, backend, id);
  expect(load<{ marks: string[] }>(server.get(drawing.url)!).marks).toEqual([
    "original",
    "new",
  ]);
});

// This measurement seeds 100 real IndexedDB records; allow for full-suite fixture setup.
test("idle account ticks do no catalog or document work; one edit visits one drawing", async () => {
  const { api, id, server } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawings = await Promise.all(
    Array.from({ length: 100 }, async (_, n) => {
      const handle = repo.create({ marks: [n] });
      await backend.createDocument({
        docUrl: handle.url,
        accountAttached: true,
      });
      await backend.saveAccountCheckpoint(handle.url, {
        documentUrl: handle.url,
        heads: getHeads(handle.doc()).sort(),
      });
      server.set(handle.url, save(handle.doc()));
      return handle;
    }),
  );
  await repo.flush();
  const watcher = watchAccountWorkspace({ api, repo, backend });
  try {
    await watcher.retry();
    await watcher.retry();
    const list = spyOn(backend, "listDocuments");
    const read = spyOn(backend, "getDocument");
    const find = spyOn(repo, "find");
    const flush = spyOn(repo, "flush");
    const checkpoint = spyOn(api, "checkpointAccountDrawing");
    await syncAccountWorkspace(api, repo, backend, id, false);
    const fullScan = {
      catalogReads: list.mock.calls.length,
      documentReads: read.mock.calls.length,
      finds: find.mock.calls.length,
    };
    expect(fullScan).toEqual({
      catalogReads: 1,
      documentReads: 100,
      finds: 100,
    });
    list.mockClear();
    read.mockClear();
    find.mockClear();
    flush.mockClear();
    checkpoint.mockClear();
    for (let n = 0; n < 10; n++) await watcher.retry();
    expect(list).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
    expect(checkpoint).not.toHaveBeenCalled();
    drawings[41].change((doc) => {
      doc.marks.push(101);
    });
    await watcher.retry();
    expect(list).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(checkpoint).toHaveBeenCalledTimes(1);
    console.log("CHECKPOINT_QUEUE_MEASUREMENT", {
      drawings: 100,
      fullScan,
      idleTicks: 10,
      idleCatalogReads: 0,
      idleFinds: 0,
      idleFlushes: 0,
      editedFinds: find.mock.calls.length,
      editedFlushes: flush.mock.calls.length,
    });
  } finally {
    watcher.dispose();
  }
}, 60000);

test("queued saves retain edits made during upload and retry failed requests", async () => {
  const { api, id, server } = fakeApi();
  const { repo, backend } = workspace(id);
  const drawing = repo.create({ marks: ["base"] });
  await backend.createDocument({ docUrl: drawing.url });
  const watcher = watchAccountWorkspace({ api, repo, backend });
  try {
    await watcher.retry();
    await watcher.retry();
    const original = api.checkpointAccountDrawing;
    let duringUpload = true;
    api.checkpointAccountDrawing = async (...args) => {
      const result = await original(...args);
      if (duringUpload) {
        duringUpload = false;
        drawing.change((doc) => {
          doc.marks.push("during upload");
        });
      }
      return result;
    };
    drawing.change((doc) => {
      doc.marks.push("before upload");
    });
    await watcher.retry();
    expect(
      load<{ marks: string[] }>(server.get(drawing.url)!).marks,
    ).not.toContain("during upload");
    await watcher.retry();
    expect(load<{ marks: string[] }>(server.get(drawing.url)!).marks).toContain(
      "during upload",
    );
    drawing.change((doc) => {
      doc.marks.push("retry me");
    });
    api.checkpointAccountDrawing = async () => {
      throw Error("offline");
    };
    await watcher.retry();
    api.checkpointAccountDrawing = original;
    await watcher.retry();
    expect(load<{ marks: string[] }>(server.get(drawing.url)!).marks).toEqual([
      "base",
      "before upload",
      "during upload",
      "retry me",
    ]);
    const added = repo.create({ marks: ["created later"] });
    await backend.createDocument({ docUrl: added.url });
    await watcher.retry();
    expect(load<{ marks: string[] }>(server.get(added.url)!).marks).toEqual([
      "created later",
    ]);
  } finally {
    watcher.dispose();
  }
});
