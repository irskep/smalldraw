import { expect, test } from "bun:test";
import { change, getHeads, load, save } from "@automerge/automerge";
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
    content: save(local),
  });
  expect(result.heads).toEqual(getHeads(local));
  expect(load<{ marks: string[] }>(result.content).marks).toContain("remote");
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
  await expect(stranger.checkpointAccountDrawing(input)).rejects.toThrow();
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
