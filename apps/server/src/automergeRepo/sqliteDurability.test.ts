import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStorageAdapter } from "./sqliteStorageAdapter";

test("WAL recovers acknowledged writes after the writer is killed without closing SQLite", async () => {
  const directory = await mkdtemp(join(tmpdir(), "drawing-wal-test-"));
  const dbPath = join(directory, "drawing.db");
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
 import {SqliteStorageAdapter} from ${JSON.stringify(join(import.meta.dir, "sqliteStorageAdapter.ts"))};
 const storage=new SqliteStorageAdapter(${JSON.stringify(dbPath)});
 await storage.save(['drawing','snapshot','test'],new Uint8Array([1,2,3,4]));
 console.log('saved');
 setInterval(()=>{},1000);
 `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  try {
    const reader = child.stdout.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("saved");
    child.kill("SIGKILL");
    await child.exited;
    const storage = new SqliteStorageAdapter(dbPath);
    expect(await storage.load(["drawing", "snapshot", "test"])).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
    const check = new Database(dbPath);
    expect(check.query("PRAGMA journal_mode").get()).toEqual({
      journal_mode: "wal",
    });
    expect(check.query("PRAGMA integrity_check").get()).toEqual({
      integrity_check: "ok",
    });
    check.close();
  } finally {
    child.kill();
    await rm(directory, { recursive: true, force: true });
  }
});
