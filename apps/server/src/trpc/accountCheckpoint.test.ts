import { expect, test } from "bun:test";
import {
  change,
  clone,
  getHeads,
  load,
  loadIncremental,
  save,
  saveSince,
} from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { repo, repoStorage } from "../automergeRepo/automergeRepo";
import { createUser } from "../db/createUser";
import { apiRouter as appRouter } from "../test/apiCaller";

async function caller(username: string) {
  const user = await createUser({ username, registrationRecord: "test" });
  return appRouter.createCaller({
    req: { headers: {} } as never,
    res: {} as never,
    session: { userId: user.id, sessionKey: username, createdAt: new Date() },
    serverAdmin: null,
  });
}

test("account registration is repeatable, and checkpoints persist and merge edits", async () => {
  const api = await caller("checkpoint-owner");
  const handle = repo.create({ marks: ["first"] });
  const content = save(handle.doc());
  const first = await api.registerAccountSyncedDocument({
    accountId: (await api.me())!.id,
    documentId: handle.documentId,
    content,
  });
  const second = await api.registerAccountSyncedDocument({
    accountId: (await api.me())!.id,
    documentId: handle.documentId,
    content,
  });
  expect(second.collabDocUrl).toBe(first.collabDocUrl);
  const local = change(load<{ marks: string[] }>(content), (doc) => {
    doc.marks.push("local");
  });
  handle.change((doc) => {
    doc.marks.push("remote");
  });
  const result = await api.checkpointAccountDrawing({
    accountId: (await api.me())!.id,
    documentId: handle.documentId,
    content: saveSince(local, getHeads(load(content))),
    baseHeads: getHeads(load(content)),
    heads: getHeads(local),
  });
  if (result.status !== "saved")
    throw Error("Expected checkpoint acknowledgement");
  expect(result.heads).toEqual(getHeads(handle.doc()));
  expect(loadIncremental(clone(local), result.content).marks).toContain(
    "remote",
  );
  expect(handle.doc().marks).toContain("local");
  expect(repoStorage.hasDocumentContent(handle.documentId)).toBe(true);
  const cold = new Repo({ storage: repoStorage, network: [] });
  const restored = await cold.find<{ marks: string[] }>(handle.documentId);
  expect(restored.doc().marks).toContain("local");
  expect(restored.doc().marks).toContain("remote");
  await cold.shutdown();
});

test("an unrelated account cannot overwrite or claim an existing document ID", async () => {
  const owner = await caller("checkpoint-owner");
  const stranger = await caller("checkpoint-stranger");
  const handle = repo.create({ private: true });
  const input = {
    accountId: (await owner.me())!.id,
    documentId: handle.documentId,
    content: save(handle.doc()),
  };
  await owner.registerAccountSyncedDocument(input);
  await expect(stranger.registerAccountSyncedDocument(input)).rejects.toThrow();
  await expect(
    stranger.checkpointAccountDrawing({
      ...input,
      baseHeads: null,
      heads: getHeads(handle.doc()),
    }),
  ).rejects.toThrow();
  expect(handle.doc()).toEqual({ private: true });
});

test("a changed login cannot register an unsynced drawing for the wrong account", async () => {
  const original = await caller("original-account");
  const changed = await caller("changed-account");
  const handle = repo.create({ marks: ["private offline work"] });
  const input = {
    accountId: (await original.me())!.id,
    documentId: handle.documentId,
    content: save(handle.doc()),
  };
  await expect(changed.registerAccountSyncedDocument(input)).rejects.toThrow(
    "Account changed",
  );
  // A rejected request must not reserve ownership for the new login.
  await original.registerAccountSyncedDocument(input);
});

test("checkpoint retries are idempotent and missing base history requests a full resync", async () => {
  const api = await caller("checkpoint-retry-owner");
  const accountId = (await api.me())!.id;
  const handle = repo.create({ marks: ["base"] });
  const original = save(handle.doc());
  const baseHeads = getHeads(handle.doc());
  await api.registerAccountSyncedDocument({
    accountId,
    documentId: handle.documentId,
    content: original,
  });
  const local = change(load<{ marks: string[] }>(original), (d) => {
    d.marks.push("new");
  });
  const input = {
    accountId,
    documentId: handle.documentId,
    baseHeads,
    heads: getHeads(local),
    content: saveSince(local, baseHeads),
  };
  for (let n = 0; n < 2; n++) {
    const result = await api.checkpointAccountDrawing(input);
    expect(result.status).toBe("saved");
    expect(handle.doc().marks).toEqual(["base", "new"]);
  }
  const lostBase = { ...input, baseHeads: ["f".repeat(64)] };
  expect(await api.checkpointAccountDrawing(lostBase)).toEqual({
    status: "resync",
  });
  handle.change((d) => {
    d.marks.push("server edit");
  });
  const result = await api.checkpointAccountDrawing({
    ...lostBase,
    baseHeads: null,
    content: save(local),
  });
  if (result.status !== "saved") throw Error("Expected resync to complete");
  expect(loadIncremental(clone(local), result.content).marks).toContain(
    "server edit",
  );
  expect(handle.doc().marks.filter((x) => x === "new")).toHaveLength(1);
});

test("missing incremental dependencies do not mutate or acknowledge a partial drawing", async () => {
  const api = await caller("checkpoint-dependencies-owner");
  const accountId = (await api.me())!.id;
  const handle = repo.create({ marks: ["base"] });
  const base = save(handle.doc());
  const baseHeads = getHeads(handle.doc());
  await api.registerAccountSyncedDocument({
    accountId,
    documentId: handle.documentId,
    content: base,
  });
  let local = change(load<{ marks: string[] }>(base), (d) => {
    d.marks.push("missing dependency");
  });
  const intermediate = getHeads(local);
  local = change(local, (d) => {
    d.marks.push("dependent edit");
  });
  const result = await api.checkpointAccountDrawing({
    accountId,
    documentId: handle.documentId,
    baseHeads,
    heads: getHeads(local),
    content: saveSince(local, intermediate),
  });
  expect(result).toEqual({ status: "resync" });
  expect(handle.doc().marks).toEqual(["base"]);
});
