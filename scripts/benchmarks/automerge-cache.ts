import { ImmutableString } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { SqliteStorageAdapter } from "../../apps/server/src/automergeRepo/sqliteStorageAdapter";
import { DocumentLifetime } from "../../apps/server/src/automergeRepo/documentLifetime";
const repo = new Repo({
  network: [],
  storage: new SqliteStorageAdapter(":memory:"),
});
const lifetime = new DocumentLifetime(repo);
const handles = Array.from({ length: 100 }, (_, i) =>
  repo.create({
    i,
    points: new ImmutableString(
      JSON.stringify(Array.from({ length: 2000 }, (_, j) => [j / 7, j % 900])),
    ),
  }),
);
const firstId = handles[0].documentId;
await repo.flush();
console.log(
  JSON.stringify({ stage: "before", loaded: Object.keys(repo.handles).length }),
);
const start = performance.now();
await lifetime.sweep();
console.log(
  JSON.stringify({
    stage: "after",
    loaded: Object.keys(repo.handles).length,
    sweepMs: performance.now() - start,
  }),
);
const reload = performance.now();
const restored = await repo.find<{ i: number }>(firstId);
if (restored.doc().i !== 0) throw Error("Lost document");
console.log(JSON.stringify({ coldReloadMs: performance.now() - reload }));
await repo.shutdown();
