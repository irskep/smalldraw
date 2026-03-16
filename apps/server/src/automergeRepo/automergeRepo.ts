import os from "node:os";
import { Repo, type RepoConfig } from "@automerge/automerge-repo";
import { WebSocketServer } from "isomorphic-ws";
import { AuthAdapter } from "./authAdapter.js";
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

const config: RepoConfig = {
  network: [new AuthAdapter(webSocketServer)],
  storage: new SqliteStorageAdapter(automergeDbPath),
  // @ts-expect-error
  peerId: `storage-server-${hostname}`,
  sharePolicy: serverSharePolicy,
};

export const repo = new Repo(config);
