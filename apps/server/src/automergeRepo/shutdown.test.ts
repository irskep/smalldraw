import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NetworkAdapter, type PeerId, Repo } from "@automerge/automerge-repo";

import { SqliteStorageAdapter } from "./sqliteStorageAdapter";

class TestNetwork extends NetworkAdapter {
  isReady() {
    return true;
  }
  async whenReady() {}
  connect(peerId: PeerId) {
    this.peerId = peerId;
  }
  send() {}
  disconnect() {}
}

test("shutdown waits for accepted async sync work and persists its final edit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shutdown-sync-"));
  const network = new TestNetwork();
  const storage = new SqliteStorageAdapter(join(directory, "drawings.db"));
  const repo = new Repo({ network: [network], storage });
  try {
    const handle = repo.create({ marks: ["first"] });
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Exercise Repo's actual network dispatch with a deliberately delayed synchronizer.
    repo.synchronizer.receiveMessage = async () => {
      await delayed;
      handle.change((doc) => {
        doc.marks.push("last");
      });
    };
    network.emit("message", {
      type: "sync",
      senderId: "client" as PeerId,
      targetId: repo.peerId,
      documentId: handle.documentId,
      data: new Uint8Array([1]),
    });
    let stopped = false;
    const shutdown = repo.shutdown().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);
    release();
    await shutdown;
    const reopened = new Repo({
      network: [],
      storage: new SqliteStorageAdapter(join(directory, "drawings.db")),
    });
    expect(
      (await reopened.find<{ marks: string[] }>(handle.url)).doc().marks,
    ).toEqual(["first", "last"]);
    await reopened.shutdown();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
