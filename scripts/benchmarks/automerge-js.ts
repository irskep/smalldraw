// Reproduce: bench:server:fixtures, bench:server:native, bench:server:js, bench:server:wasm.
// Run each mise task sequentially. Fixtures live in /tmp; no production data is read.
// Medians of 20 warm CPU runs / 50 durable I/O runs. Run without concurrent builds.
// WAL NORMAL is exploratory: it weakens crash durability compared with FULL.
import * as A from "@automerge/automerge";
import { SqliteStorageAdapter } from "../../apps/server/src/automergeRepo/sqliteStorageAdapter.ts";
import { Database } from "bun:sqlite";
import { isDeepStrictEqual } from "node:util";
const median = (a: number[]) =>
  a.sort((a, b) => a - b)[Math.floor(a.length / 2)];
for (const name of ["small", "medium", "large"]) {
  const bytes = new Uint8Array(
    await Bun.file(`/tmp/smalldraw-${name}.automerge`).arrayBuffer(),
  );
  const nativeFile = Bun.file(`/tmp/smalldraw-${name}.automerge.native`);
  if (await nativeFile.exists()) {
    const original = A.load(bytes),
      native = A.load(new Uint8Array(await nativeFile.arrayBuffer()));
    if (
      !isDeepStrictEqual(A.getHeads(original), A.getHeads(native)) ||
      !isDeepStrictEqual(A.toJS(original), A.toJS(native))
    )
      throw Error("Native roundtrip changed document");
    A.free(original);
    A.free(native);
  }
  const loads = [],
    saves = [],
    imports = [];
  for (let i = 0; i < 25; i++) {
    const start = performance.now();
    const doc = A.load(bytes);
    const l = performance.now() - start;
    const s = performance.now();
    A.save(doc);
    const elapsed = performance.now() - s;
    A.free(doc);
    if (i >= 5) {
      loads.push(l);
      saves.push(elapsed);
    }
  }
  for (let i = 0; i < 25; i++) {
    const start = performance.now();
    const doc = A.loadIncremental(A.init(), bytes);
    const elapsed = performance.now() - start;
    A.free(doc);
    if (i >= 5) imports.push(elapsed);
  }
  console.log(
    JSON.stringify({
      name,
      bytes: bytes.length,
      load: median(loads),
      save: median(saves),
      importIntoEmpty: median(imports),
    }),
  );
  for (const mode of ["default", "wal-full", "wal-normal"]) {
    const path = `/tmp/perf-${name}-${mode}-${Date.now()}.db`;
    const adapter = new SqliteStorageAdapter(path);
    const db = new Database(path);
    if (mode !== "default") {
      db.run("PRAGMA journal_mode=WAL");
      db.close(); // synchronous is connection-local: configure the actual adapter connection
      // Benchmark-only inspection; production adapter remains unchanged.
      (adapter as any).db.run(
        `PRAGMA synchronous=${mode === "wal-full" ? "FULL" : "NORMAL"}`,
      );
    }
    const writes = [],
      reads = [];
    for (let i = 0; i < 55; i++) {
      const key = ["test", "snapshot", String(i)];
      let start = performance.now();
      await adapter.save(key, bytes);
      const w = performance.now() - start;
      start = performance.now();
      const loaded = await adapter.load(key);
      if (!Buffer.from(loaded!).equals(bytes)) throw Error("mismatch");
      const r = performance.now() - start;
      if (i >= 5) {
        writes.push(w);
        reads.push(r);
      }
    }
    console.log(
      JSON.stringify({
        name,
        mode,
        write: median(writes),
        read: median(reads),
      }),
    );
    (adapter as any).db.close();
    if (mode === "default") db.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = Bun.file(path + suffix);
      if (await file.exists()) await file.delete();
    }
  }
}
