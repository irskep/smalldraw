import os from "node:os";
import { Repo, type RepoConfig } from "@automerge/automerge-repo";
import { WebSocketServer } from "isomorphic-ws";
import { AuthAdapter } from "./authAdapter.js";
import { DocumentLifetime } from "./documentLifetime.js";
import { SqliteStorageAdapter } from "./sqliteStorageAdapter.js";

const automergeDbPath = process.env.AUTOMERGE_DB_PATH ?? "./automerge.db";

export const webSocketServer = new WebSocketServer({ noServer: true });

const hostname = os.hostname();

export async function serverSharePolicy(
  _peerId: string,
  documentId?: string,
): Promise<boolean> {
  return Boolean(documentId);
}

export const repoStorage = new SqliteStorageAdapter(automergeDbPath);

const adapter = new AuthAdapter(webSocketServer);
const config: RepoConfig = {
  network: [adapter],
  storage: repoStorage,
  // @ts-expect-error
  peerId: `storage-server-${hostname}`,
  sharePolicy: serverSharePolicy,
};

export const repo = new Repo(config);

export const documentLifetime = new DocumentLifetime(repo);
adapter.documentLifetime = documentLifetime;
const idleSweep = setInterval(() => {
  void documentLifetime.sweep();
}, 15_000);
idleSweep.unref();

/** Stop receiving edits before disconnecting peers and flushing accepted sync work. */
export async function stopRepositoryNetwork(): Promise<void> {
  clearInterval(idleSweep);
  await adapter.drain();
  adapter.disconnect();
  await new Promise<void>((resolve, reject) => {
    webSocketServer.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function shutdownRepository(): Promise<void> {
  await documentLifetime.sweep();
  await repo.shutdown();
}
