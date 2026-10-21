import { expect, test } from "bun:test";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { from, save } from "@automerge/automerge";
import {
  cbor,
  generateAutomergeUrl,
  parseAutomergeUrl,
  Repo,
} from "@automerge/automerge-repo";
import WebSocket from "isomorphic-ws";
import { SqliteStorageAdapter } from "./automergeRepo/sqliteStorageAdapter";

async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

test("real server SIGTERM exits with an open authenticated socket and durable guest drawing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "server-lifecycle-"));
  const port = await freePort();
  const dbPath = join(directory, "drawings.db");
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import { migrate } from "drizzle-orm/bun-sqlite/migrator";
    import { db } from "./src/db/client.ts";
    migrate(db, { migrationsFolder: "./drizzle" });
    await import("./src/index.ts");
  `,
    ],
    {
      cwd: join(import.meta.dir, ".."),
      env: {
        ...process.env,
        PORT: String(port),
        METRICS_PORT: "",
        NODE_ENV: "test",
        DATABASE_URL: join(directory, "account.db"),
        AUTOMERGE_DB_PATH: dbPath,
        OPAQUE_SERVER_SETUP: "startup-only-test",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const logs = new Response(child.stdout).text();
  const errors = new Response(child.stderr).text();
  let socket: WebSocket | undefined;
  try {
    const origin = `http://127.0.0.1:${port}`;
    let healthy = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        healthy = (await fetch(`${origin}/healthz`)).ok;
      } catch {}
      if (healthy || child.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(healthy).toBe(true);
    const { documentId } = parseAutomergeUrl(generateAutomergeUrl());
    const response = await fetch(
      `${origin}/api/v1/documents/registerCollaborativeDocument`,
      {
        method: "POST",
        headers: { "Content-Type": "application/cbor" },
        body: cbor.encode({
          documentId,
          deviceTag: "shutdown-test",
          content: save(from({ marks: ["kept"] })),
        }) as Uint8Array<ArrayBuffer>,
      },
    );
    expect(response.status).toBe(200);
    const envelope = cbor.decode(
      new Uint8Array(await response.arrayBuffer()),
    ) as { result: { accessToken: string } };
    socket = new WebSocket(
      `ws://127.0.0.1:${port}/?token=${envelope.result.accessToken}`,
    );
    await once(socket, "open");
    child.kill("SIGTERM");
    const exit = await Promise.race([
      child.exited,
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 4000)),
    ]);
    if (exit !== 0) {
      child.kill("SIGKILL");
      await child.exited;
      console.error(await logs, await errors);
    }
    expect(exit).toBe(0);
    expect(await logs).toContain("flushed and stopped");
    expect(await errors).not.toContain("shutdown] failed");
    const reopened = new Repo({
      network: [],
      storage: new SqliteStorageAdapter(dbPath),
    });
    expect(
      (await reopened.find<{ marks: string[] }>(documentId)).doc().marks,
    ).toEqual(["kept"]);
    await reopened.shutdown();
  } finally {
    socket?.terminate();
    child.kill("SIGKILL");
    await child.exited;
    await rm(directory, { recursive: true, force: true });
  }
}, 10000);

test("startup rejects an unmigrated account database before becoming ready", async () => {
  const directory = await mkdtemp(join(tmpdir(), "server-not-ready-"));
  try {
    const child = Bun.spawn([process.execPath, "src/index.ts"], {
      cwd: join(import.meta.dir, ".."),
      env: {
        ...process.env,
        PORT: "0",
        METRICS_PORT: "",
        NODE_ENV: "test",
        DATABASE_URL: join(directory, "account.db"),
        AUTOMERGE_DB_PATH: join(directory, "drawings.db"),
        OPAQUE_SERVER_SETUP: "startup-only-test",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await child.exited).not.toBe(0);
    expect(await new Response(child.stdout).text()).not.toContain("Listening");
    expect(await new Response(child.stderr).text()).toContain(
      "no such table: users",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
