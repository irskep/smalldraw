import { Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { apiProductionHost } from "../constants";

declare global {
  interface Window {
    __automergeRepo?: Repo;
  }
}

let repo: Repo | undefined;
let browserWebSocketClientAdapter: BrowserWebSocketClientAdapter | undefined;
let broadcastAdapter: BroadcastChannelNetworkAdapter | undefined;

export const initializeRepo = (sessionKey: string | null) => {
  // disconnect the previous websocket connection
  if (browserWebSocketClientAdapter) {
    browserWebSocketClientAdapter.disconnect();
    browserWebSocketClientAdapter.socket?.close();
  }

  const authorizationToken = sessionKey;
  const syncServerUrl = (() => {
    const baseUrl = import.meta.env.PROD
      ? typeof window !== "undefined"
        ? window.location.origin
        : `https://${apiProductionHost}`
      : "http://localhost:3030";

    const url = new URL(baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("sessionKey", authorizationToken || "");
    return url.toString();
  })();

  browserWebSocketClientAdapter = new BrowserWebSocketClientAdapter(
    syncServerUrl,
  );
  broadcastAdapter = new BroadcastChannelNetworkAdapter();

  repo = new Repo({
    network: [broadcastAdapter, browserWebSocketClientAdapter],
    storage: new IndexedDBStorageAdapter(),
  });

  if (typeof window !== "undefined") {
    window.__automergeRepo = repo;
  }
};

// DO NOT USE - not working properly
// see https://github.com/automerge/automerge-repo/issues/357
export const removeRepo = () => {
  // disconnect the previous websocket connection
  if (browserWebSocketClientAdapter) {
    browserWebSocketClientAdapter.disconnect();
    browserWebSocketClientAdapter.socket?.close();
  }

  if (repo) {
    repo = undefined;
  }
};

export const getRepo = () => repo;

if (localStorage.getItem("sessionKey")) {
  initializeRepo(localStorage.getItem("sessionKey"));
}
