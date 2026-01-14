import { Repo, RepoConfig } from "@automerge/automerge-repo";
import os from "os";
import { WebSocketServer } from "isomorphic-ws";
import { AuthAdapter } from "./authAdapter.js";
import { SqliteStorageAdapter } from "./sqliteStorageAdapter.js";

const automergeDbPath = process.env.AUTOMERGE_DB_PATH ?? "./automerge.db";

export const webSocketServer = new WebSocketServer({ noServer: true });

const hostname = os.hostname();
const config: RepoConfig = {
  network: [new AuthAdapter(webSocketServer)],
  storage: new SqliteStorageAdapter(automergeDbPath),
  // @ts-expect-error
  peerId: `storage-server-${hostname}`,
  sharePolicy: async () => false,
};

export const repo = new Repo(config);
