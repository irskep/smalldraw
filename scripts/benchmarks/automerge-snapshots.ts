import * as A from "@automerge/automerge";
import { SnapshotCache } from "../../apps/server/src/automergeRepo/snapshotCache";
const doc = A.from({
  points: new A.ImmutableString(
    JSON.stringify(Array.from({ length: 64000 }, (_, i) => [i / 7, i % 900])),
  ),
});
const cache = new SnapshotCache();
for (const cached of [false, true]) {
  const times: number[] = [];
  for (let i = 0; i < 105; i++) {
    const start = performance.now();
    const bytes = cached ? cache.get("drawing", doc) : A.save(doc);
    if (!bytes.length) throw Error("Empty snapshot");
    if (i >= 5) times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      cached,
      medianMs: times[50],
      cacheBytes: cache.sizeBytes,
    }),
  );
}
A.free(doc);
