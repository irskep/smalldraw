import { expect, test } from "bun:test";
import * as A from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { importValidatedDocument } from "./importValidatedDocument";
import { SqliteStorageAdapter } from "./sqliteStorageAdapter";

test("validated import preserves cold server edits and owns an independent document", async () => {
  const storage = new SqliteStorageAdapter(":memory:");
  const first = new Repo({ network: [], storage });
  const handle = first.create({ marks: ["original"] });
  const incoming = A.clone(handle.doc());
  handle.change((doc) => {
    doc.marks.push("server");
  });
  await first.flush();
  await first.shutdown();
  const second = new Repo({ network: [], storage });
  const edited = A.change(incoming, (doc) => {
    doc.marks.push("client");
  });
  const result = await importValidatedDocument(
    second,
    storage,
    handle.documentId,
    edited,
  );
  A.free(edited);
  expect(result.doc().marks).toContain("server");
  expect(result.doc().marks).toContain("client");
  await second.shutdown();
  const third = new Repo({ network: [], storage });
  expect((await third.find(handle.documentId)).doc()).toEqual(result.doc());
  await third.shutdown();
});
