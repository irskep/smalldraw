import type { NetworkAdapterInterface } from "@automerge/automerge-repo/slim";
import { Repo } from "@automerge/automerge-repo/slim";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { createServerAnnouncePolicy } from "./repoSharePolicy";

export interface CreateLocalSmalldrawRepoOptions {
  websocketUrl?: string;
  websocketAuthToken?: string;
  websocketAuthorizedDocumentId?: string;
  isCollaborativeDocumentId?: (documentId: string) => Promise<boolean>;
  onWebsocketConnectedChange?: (connected: boolean) => void;
}

export type LocalSmalldrawRepo = Repo & {
  setWebsocketAuthToken: (token: string | null) => void;
  setWebsocketAuthorizedDocumentId: (documentId: string | null) => void;
  isWebsocketConnected: () => boolean;
};

export function canCreateWebsocketAdapter(
  websocketUrl: string | undefined,
  token: string | null,
): boolean {
  return Boolean(websocketUrl && token);
}

export function shouldAnnounceDocumentToServer(options: {
  documentId: string;
  websocketAuthorizedDocumentId: string | null;
}): boolean {
  const { documentId, websocketAuthorizedDocumentId } = options;
  if (!websocketAuthorizedDocumentId) {
    return true;
  }
  return documentId === websocketAuthorizedDocumentId;
}

export function createLocalSmalldrawRepo(
  options: CreateLocalSmalldrawRepoOptions = {},
): LocalSmalldrawRepo {
  const network: NetworkAdapterInterface[] = [
    new BroadcastChannelNetworkAdapter(),
  ];
  let serverPeerId: string | null = null;
  let websocketConnected = false;
  let websocketAuthToken = options.websocketAuthToken ?? null;
  let websocketAuthorizedDocumentId =
    options.websocketAuthorizedDocumentId ?? null;
  const publishWebsocketConnected = (connected: boolean): void => {
    if (websocketConnected === connected) {
      return;
    }
    console.info("[kids-draw:multiplayer] websocket state changed", {
      connected,
    });
    websocketConnected = connected;
    options.onWebsocketConnectedChange?.(connected);
  };

  const attachWebsocketAdapter = (
    repo: Repo,
    adapter: BrowserWebSocketClientAdapter,
  ): void => {
    adapter.on("peer-candidate", ({ peerId }) => {
      console.info("[kids-draw:multiplayer] websocket peer candidate", {
        peerId,
      });
      serverPeerId = peerId;
      publishWebsocketConnected(true);
    });
    adapter.on("peer-disconnected", ({ peerId }) => {
      console.warn("[kids-draw:multiplayer] websocket peer disconnected", {
        peerId,
      });
      if (serverPeerId !== peerId) {
        return;
      }
      serverPeerId = null;
      publishWebsocketConnected(false);
    });
    adapter.on("close", () => {
      console.warn("[kids-draw:multiplayer] websocket adapter closed");
      serverPeerId = null;
      publishWebsocketConnected(false);
    });
    repo.networkSubsystem.addNetworkAdapter(adapter);
  };

  const createWebsocketAdapter = (): BrowserWebSocketClientAdapter | null => {
    const websocketUrl = options.websocketUrl;
    if (!websocketUrl || !websocketAuthToken) {
      console.info("[kids-draw:multiplayer] websocket adapter not created", {
        hasWebsocketUrl: Boolean(websocketUrl),
        hasToken: Boolean(websocketAuthToken),
      });
      return null;
    }
    const url = buildServerWebsocketUrl(websocketUrl, websocketAuthToken);
    console.info("[kids-draw:multiplayer] websocket adapter created", {
      url,
    });
    return new BrowserWebSocketClientAdapter(url);
  };

  const repo = new Repo({
    storage: new IndexedDBStorageAdapter(),
    network,
    shareConfig: {
      announce: createServerAnnouncePolicy({
        getServerPeerId: () => serverPeerId,
        isCollaborativeDocumentId: async (documentId) => {
          if (websocketAuthorizedDocumentId) {
            const allowedByScope = shouldAnnounceDocumentToServer({
              documentId,
              websocketAuthorizedDocumentId,
            });
            if (!allowedByScope) {
              console.info(
                "[kids-draw:multiplayer] announce blocked by token doc scope",
                {
                  documentId,
                  websocketAuthorizedDocumentId,
                },
              );
              return false;
            }
            // When token-scoped auth is active, allow only the scoped doc and
            // skip catalog-index checks to avoid stale metadata races.
            return true;
          }
          if (
            !shouldAnnounceDocumentToServer({
              documentId,
              websocketAuthorizedDocumentId,
            })
          ) {
            console.info(
              "[kids-draw:multiplayer] announce blocked by token doc scope",
              {
                documentId,
                websocketAuthorizedDocumentId,
              },
            );
            return false;
          }
          if (!options.isCollaborativeDocumentId) {
            return true;
          }
          return await options.isCollaborativeDocumentId(documentId);
        },
      }),
      access: async () => true,
    },
  });

  let websocketAdapter = createWebsocketAdapter();
  if (websocketAdapter) {
    attachWebsocketAdapter(repo, websocketAdapter);
  }

  return Object.assign(repo, {
    setWebsocketAuthToken(token: string | null): void {
      const nextToken = token && token.length > 0 ? token : null;
      if (websocketAuthToken === nextToken) {
        console.info(
          "[kids-draw:multiplayer] websocket auth token unchanged; skipping adapter reset",
        );
        return;
      }
      console.info("[kids-draw:multiplayer] websocket auth token update", {
        previousToken: websocketAuthToken,
        nextToken,
      });
      websocketAuthToken = nextToken;
      if (!options.websocketUrl) {
        return;
      }
      if (websocketAdapter) {
        repo.networkSubsystem.removeNetworkAdapter(websocketAdapter);
        websocketAdapter = null;
      }
      serverPeerId = null;
      publishWebsocketConnected(false);
      if (!nextToken) {
        return;
      }
      websocketAdapter = createWebsocketAdapter();
      if (websocketAdapter) {
        attachWebsocketAdapter(repo, websocketAdapter);
      }
    },
    setWebsocketAuthorizedDocumentId(documentId: string | null): void {
      websocketAuthorizedDocumentId =
        documentId && documentId.length > 0 ? documentId : null;
      console.info("[kids-draw:multiplayer] websocket authorized doc update", {
        websocketAuthorizedDocumentId,
      });
    },
    isWebsocketConnected(): boolean {
      return websocketConnected;
    },
  });
}

function buildServerWebsocketUrl(
  baseWebsocketUrl: string,
  token: string | null,
): string {
  if (!token) {
    return baseWebsocketUrl;
  }
  const url = new URL(baseWebsocketUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
