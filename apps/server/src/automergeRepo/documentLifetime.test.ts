import { expect, spyOn, test } from "bun:test";
import { Repo } from "@automerge/automerge-repo";
import { DocumentLifetime } from "./documentLifetime";
import { SqliteStorageAdapter } from "./sqliteStorageAdapter";

test("idle copies are bounded, active copies stay pinned, and evicted edits reload", async () => {
  const repo = new Repo({
    network: [],
    storage: new SqliteStorageAdapter(":memory:"),
  });
  const lifetime = new DocumentLifetime(repo, { maxIdle: 2, idleMs: 1000 });
  const handles = Array.from({ length: 20 }, (_, i) =>
    repo.create({ value: i }),
  );
  const release = await lifetime.acquire(handles[0].documentId);
  handles[1].change((doc) => {
    doc.value = 100;
  });
  await lifetime.sweep();
  expect(Object.keys(repo.handles)).toHaveLength(3);
  expect(repo.handles[handles[0].documentId]).toBe(handles[0]);
  const restored = await lifetime.use(handles[1].documentId, async () =>
    repo.find<{ value: number }>(handles[1].documentId),
  );
  expect(restored.doc().value).toBe(100);
  release();
  await lifetime.sweep();
  expect(Object.keys(repo.handles)).toHaveLength(2);
  await repo.shutdown();
});

test("a request arriving during flush prevents eviction; failed flush retains content", async () => {
  const repo = new Repo({
    network: [],
    storage: new SqliteStorageAdapter(":memory:"),
  });
  const lifetime = new DocumentLifetime(repo, { maxIdle: 0, idleMs: 0 });
  const handle = repo.create({ value: 1 });
  let finish!: () => void;
  const flush = spyOn(repo, "flush").mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const sweeping = lifetime.sweep();
  const acquiring = lifetime.acquire(handle.documentId);
  finish();
  const release = await acquiring;
  await sweeping;
  expect(repo.handles[handle.documentId]).toBe(handle);
  release();
  flush.mockRejectedValueOnce(new Error("disk full"));
  await lifetime.sweep();
  expect(repo.handles[handle.documentId]).toBe(handle);
  flush.mockRestore();
  await lifetime.sweep();
  expect(repo.handles[handle.documentId]).toBeUndefined();
  expect((await repo.find(handle.documentId)).doc()).toEqual({ value: 1 });
  await repo.shutdown();
});

test("a request arriving during removal waits for removal before reopening", async () => {
  const repo = new Repo({
    network: [],
    storage: new SqliteStorageAdapter(":memory:"),
  });
  const lifetime = new DocumentLifetime(repo, { maxIdle: 0, idleMs: 0 });
  const handle = repo.create({ value: 1 });
  const original = repo.removeFromCache.bind(repo);
  let removing!: () => void;
  const started = new Promise<void>((resolve) => {
    removing = resolve;
  });
  let finish!: () => void;
  const wait = new Promise<void>((resolve) => {
    finish = resolve;
  });
  spyOn(repo, "removeFromCache").mockImplementationOnce(async (id) => {
    removing();
    await wait;
    await original(id);
  });
  const sweeping = lifetime.sweep();
  await started;
  let used = false;
  const use = lifetime.use(handle.documentId, async () => {
    used = true;
    const reopened = await repo.find<{ value: number }>(handle.documentId);
    reopened.change((doc) => {
      doc.value = 2;
    });
    await repo.flush();
  });
  expect(used).toBe(false);
  finish();
  await Promise.all([sweeping, use]);
  expect((await repo.find(handle.documentId)).doc()).toEqual({ value: 2 });
  await repo.shutdown();
});

test("unloading is not persisted as an edit and leaves no pending sync readiness wait", async () => {
  const repo = new Repo({
    network: [],
    storage: new SqliteStorageAdapter(":memory:"),
  });
  const lifetime = new DocumentLifetime(repo, { maxIdle: 0, idleMs: 0 });
  const handle = repo.create({ value: 1 });
  let edits = 0;
  let waiting = 0;
  handle.on("heads-changed", () => {
    edits++;
  });
  handle.on("change", () => {
    edits++;
  });
  const ready = handle.whenReady.bind(handle);
  spyOn(handle, "whenReady").mockImplementation(async (...args) => {
    waiting++;
    try {
      return await ready(...args);
    } finally {
      waiting--;
    }
  });
  await lifetime.sweep();
  expect(edits).toBe(0);
  // Let Automerge's pending 100ms sync debounce execute after the unload.
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(waiting).toBe(0);
  expect((await repo.find(handle.documentId)).doc()).toEqual({ value: 1 });
  await repo.shutdown();
});
