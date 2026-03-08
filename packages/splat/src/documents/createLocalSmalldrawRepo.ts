import type { NetworkAdapterInterface } from "@automerge/automerge-repo/slim";
import { Repo } from "@automerge/automerge-repo/slim";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { createServerAnnouncePolicy } from "./repoSharePolicy";

export interface CreateLocalSmalldrawRepoOptions {
  websocketUrl?: string;
  isCollaborativeDocumentId?: (documentId: string) => Promise<boolean>;
  onWebsocketConnectedChange?: (connected: boolean) => void;
}

export function createLocalSmalldrawRepo(
  options: CreateLocalSmalldrawRepoOptions = {},
): Repo {
  const network: NetworkAdapterInterface[] = [
    new BroadcastChannelNetworkAdapter(),
  ];
  let serverPeerId: string | null = null;
  let websocketConnected = false;
  const publishWebsocketConnected = (connected: boolean): void => {
    if (websocketConnected === connected) {
      return;
    }
    websocketConnected = connected;
    options.onWebsocketConnectedChange?.(connected);
  };

  if (options.websocketUrl) {
    const websocketAdapter = new BrowserWebSocketClientAdapter(
      options.websocketUrl,
    );
    websocketAdapter.on("peer-candidate", ({ peerId }) => {
      serverPeerId = peerId;
      publishWebsocketConnected(true);
    });
    websocketAdapter.on("peer-disconnected", ({ peerId }) => {
      if (serverPeerId !== peerId) {
        return;
      }
      serverPeerId = null;
      publishWebsocketConnected(false);
    });
    websocketAdapter.on("close", () => {
      serverPeerId = null;
      publishWebsocketConnected(false);
    });
    network.push(websocketAdapter);
  }

  return new Repo({
    storage: new IndexedDBStorageAdapter(),
    network,
    shareConfig: {
      announce: createServerAnnouncePolicy({
        getServerPeerId: () => serverPeerId,
        isCollaborativeDocumentId: async (documentId) => {
          if (!options.isCollaborativeDocumentId) {
            return true;
          }
          return await options.isCollaborativeDocumentId(documentId);
        },
      }),
      access: async () => true,
    },
  });
}
