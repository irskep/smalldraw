import { expect, test } from "bun:test";
import { change, getHeads, load, save } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { repo, repoStorage } from "../automergeRepo/automergeRepo";
import { createUser } from "../db/createUser";
import { appRouter } from "./appRouter";

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
  const content = Buffer.from(save(handle.doc())).toString("base64");
  const first = await api.registerAccountSyncedDocument({
    documentId: handle.documentId,
    content,
  });
  const second = await api.registerAccountSyncedDocument({
    documentId: handle.documentId,
    content,
  });
  expect(second.collabDocUrl).toBe(first.collabDocUrl);
  const local = change(
    load<{ marks: string[] }>(Buffer.from(content, "base64")),
    (doc) => {
      doc.marks.push("local");
    },
  );
  handle.change((doc) => {
    doc.marks.push("remote");
  });
  const result = await api.checkpointAccountDrawing({
    documentId: handle.documentId,
    content: Buffer.from(save(local)).toString("base64"),
  });
  expect(result.heads).toEqual(getHeads(local));
  expect(
    load<{ marks: string[] }>(Buffer.from(result.content, "base64")).marks,
  ).toContain("remote");
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
    documentId: handle.documentId,
    content: Buffer.from(save(handle.doc())).toString("base64"),
  };
  await owner.registerAccountSyncedDocument(input);
  await expect(stranger.registerAccountSyncedDocument(input)).rejects.toThrow();
  await expect(stranger.checkpointAccountDrawing(input)).rejects.toThrow();
  expect(handle.doc()).toEqual({ private: true });
});
