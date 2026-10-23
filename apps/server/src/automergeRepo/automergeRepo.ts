import os from "node:os";

import { Repo, type RepoConfig } from "@automerge/automerge-repo";
import { WebSocketServer } from "isomorphic-ws";

import {
  assertDocumentAvailable,
  isDocumentBlocked,
  recordDocumentContentChange,
} from "../db/documentModeration.js";
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
  return Boolean(documentId) && !isDocumentBlocked(documentId!);
}

export const repoStorage = new SqliteStorageAdapter(automergeDbPath, {
  isBlocked: isDocumentBlocked,
});

export const adapter = new AuthAdapter(webSocketServer);
const config: RepoConfig = {
  network: [adapter],
  storage: repoStorage,
  // @ts-expect-error
  peerId: `storage-server-${hostname}`,
  sharePolicy: serverSharePolicy,
};

export const repo = new Repo(config);

export const documentLifetime = new DocumentLifetime(
  repo,
  undefined,
  undefined,
  assertDocumentAvailable,
);
adapter.documentLifetime = documentLifetime;
// Repo's storage subsystem skips unchanged heads before emitting these metrics.
// Its advertised `document` event is not emitted by the installed implementation.
repo.on("doc-metrics", (event) => {
  if (event.type === "doc-saved" || event.type === "doc-compacted")
    recordDocumentContentChange(event.documentId);
});
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
  await documentLifetime.waitForSweep();
  await repo.shutdown();
}
