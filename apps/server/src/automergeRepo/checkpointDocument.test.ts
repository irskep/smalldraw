import { expect, spyOn, test } from "bun:test";
import { change, clone, getHeads, saveSince } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { checkpointDocument } from "./checkpointDocument";

test("checkpoints wait for storage, reject failed writes, and retry without duplicates", async () => {
  const repo = new Repo({ network: [] });
  const handle = repo.create({ marks: ["base"] });
  const baseHeads = getHeads(handle.doc());
  const edited = change(clone(handle.doc()), (doc) => {
    doc.marks.push("new");
  });
  const input = {
    baseHeads,
    heads: getHeads(edited),
    content: saveSince(edited, baseHeads),
  };
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const flush = spyOn(repo, "flush").mockImplementationOnce(() => pending);
  let acknowledged = false;
  const checkpoint = checkpointDocument(repo, handle, input).then((result) => {
    acknowledged = true;
    return result;
  });
  await Promise.resolve();
  expect(acknowledged).toBe(false);
  // Later changes must not be advertised as part of this captured acknowledgement.
  handle.change((doc) => {
    doc.marks.push("later");
  });
  release();
  const result = await checkpoint;
  expect(result.status).toBe("saved");
  if (result.status === "saved") expect(result.heads).toEqual(input.heads);
  flush.mockRejectedValueOnce(new Error("disk full"));
  await expect(checkpointDocument(repo, handle, input)).rejects.toThrow(
    "disk full",
  );
  flush.mockRestore();
  expect((await checkpointDocument(repo, handle, input)).status).toBe("saved");
  expect(handle.doc().marks).toEqual(["base", "new", "later"]);
  await repo.shutdown();
});
