import type { DrawingDocumentSize } from "@smalldraw/core";
import { createCollaborationStatusStore } from "../controller/stores/createCollaborationStatusStore";
import type { KidsDocumentSummary } from "../documents";
import {
  createCollaborativeDocumentIndex,
  createLocalDocumentBackend,
  type KidsDocumentBackend,
} from "../documents";
import { resolveLayoutMode, resolvePageSize } from "../layout/responsiveLayout";
import { createKidsShapeRendererRegistry } from "../render/kidsShapeRendererRegistry";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import {
  createMultiplayerApiClient,
  type MultiplayerApiClient,
} from "./createMultiplayerApiClient";
import {
  resolveAccountDocumentForLocalOpen,
  resolveAuthorizedCollaborativeDocumentId,
  resolveInitialDocumentSize,
  resolveStartupPreImportsAndCurrentDocument,
  resolveStartupWebsocketToken,
  syncAccountCatalog,
} from "./documentBootstrap";
import { bootstrapKidsDrawRuntime } from "./runtimeBootstrap";
import type { KidsDrawAppOptions } from "./types";

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 600;

export type AppRuntimeAssembly = {
  documentBackend: KidsDocumentBackend;
  multiplayerApiClient: MultiplayerApiClient | null;
  collaborationStatusStore: ReturnType<typeof createCollaborationStatusStore>;
  collaborativeDocumentIndex: ReturnType<typeof createCollaborativeDocumentIndex>;
  shapeHandlers: ReturnType<typeof createKidsShapeHandlerRegistry>;
  shapeRendererRegistry: ReturnType<typeof createKidsShapeRendererRegistry>;
  core: Awaited<ReturnType<typeof bootstrapKidsDrawRuntime>>["core"];
  localRepo: Awaited<ReturnType<typeof bootstrapKidsDrawRuntime>>["localRepo"];
  providedCore: boolean;
  desiredInitialSize: DrawingDocumentSize;
  initialSize: DrawingDocumentSize;
  backgroundColor: string;
  deviceTag: string;
  initialCatalogDocUrl: string | null;
  sizingPolicy: {
    hasExplicitSize: boolean;
    getExplicitSize: () => DrawingDocumentSize;
    resolvePageSize: () => DrawingDocumentSize;
  };
  prepareDocumentOpen:
    | ((summary: KidsDocumentSummary | null) => Promise<void>)
    | undefined;
};

export async function assembleAppRuntime(
  options: KidsDrawAppOptions,
): Promise<AppRuntimeAssembly> {
  const hasExplicitSize =
    options.width !== undefined || options.height !== undefined;
  const getExplicitSize = (): DrawingDocumentSize => ({
    width: options.width ?? DEFAULT_WIDTH,
    height: options.height ?? DEFAULT_HEIGHT,
  });
  const resolveCurrentPageSize = (): DrawingDocumentSize =>
    resolvePageSize(getExplicitSize());
  const resolvedImplicitPageSize = resolveCurrentPageSize();
  const desiredInitialSize: DrawingDocumentSize = hasExplicitSize
    ? getExplicitSize()
    : resolvedImplicitPageSize;

  if (typeof window !== "undefined") {
    console.info("[kids-draw:size] initial-page-size", {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      layoutMode: resolveLayoutMode(window.innerWidth, window.innerHeight),
      hasExplicitSize,
      explicitFallback: getExplicitSize(),
      resolvedImplicitPageSize,
      desiredInitialSize,
    });
  }

  const shapeHandlers = createKidsShapeHandlerRegistry();
  const shapeRendererRegistry = createKidsShapeRendererRegistry();
  const documentBackend =
    options.documentBackend ??
    createLocalDocumentBackend({
      currentDocStorageKey: "kids-draw-doc-url",
    });
  const providedCore = options.core;
  const collaborationStatusStore = createCollaborationStatusStore();
  const collaborativeDocumentIndex = createCollaborativeDocumentIndex({
    listDocuments: () => documentBackend.listDocuments(),
  });
  const multiplayerApiClient = options.multiplayer?.syncServerHttpUrl
    ? createMultiplayerApiClient({
        apiUrl: options.multiplayer.syncServerHttpUrl,
      })
    : null;
  const startupIntent = options.multiplayer?.startupIntent ?? {
    kind: "open-last-local" as const,
  };
  const deviceTag = options.multiplayer?.deviceTag ?? "unknown-device";

  if (
    (startupIntent.kind === "open-share-link" ||
      startupIntent.kind === "open-account-document") &&
    !multiplayerApiClient
  ) {
    throw new Error("Multiplayer API is not configured.");
  }

  const syncedAccountDocument = await syncAccountCatalog({
    documentBackend,
    multiplayerApiClient,
    selectFirstIfNoCurrent:
      startupIntent.kind === "open-last-local" ||
      startupIntent.kind === "open-local-document",
  });
  const startupPreImports = await resolveStartupPreImportsAndCurrentDocument({
    documentBackend,
    multiplayerApiClient,
    startupIntent,
    deviceTag,
    syncedAccountDocument,
  });

  const initialCatalogDocUrl = await documentBackend.getCurrentDocument();
  const initialCatalogSummary = initialCatalogDocUrl
    ? await documentBackend.getDocument(initialCatalogDocUrl)
    : null;
  const startupWebsocketToken = resolveStartupWebsocketToken(
    initialCatalogSummary,
  );
  const startupAuthorizedCollaborativeDocumentId =
    resolveAuthorizedCollaborativeDocumentId(
      startupWebsocketToken,
      initialCatalogSummary,
    );

  const { core, localRepo } = await bootstrapKidsDrawRuntime({
    providedCore,
    websocketUrl: options.multiplayer?.syncServerWebSocketUrl,
    websocketAuthToken: startupWebsocketToken,
    websocketAuthorizedDocumentId: startupAuthorizedCollaborativeDocumentId,
    hasCollaborativeDocumentId: (documentId) =>
      collaborativeDocumentIndex.hasDocumentId(documentId),
    onWebsocketConnectedChange: (connected) => {
      collaborationStatusStore.setWebsocketConnected(connected);
    },
    documentBackend,
    preImports: startupPreImports,
    documentSize: desiredInitialSize,
    shapeHandlers,
  });

  const prepareDocumentOpen = multiplayerApiClient
    ? async (summary: KidsDocumentSummary | null) => {
        await resolveAccountDocumentForLocalOpen({
          documentBackend,
          multiplayerApiClient,
          localRepo,
          deviceTag,
          summary,
        });
      }
    : undefined;

  const initialSize = resolveInitialDocumentSize(
    core.storeAdapter.getDoc(),
    desiredInitialSize,
  );

  return {
    documentBackend,
    multiplayerApiClient,
    collaborationStatusStore,
    collaborativeDocumentIndex,
    shapeHandlers,
    shapeRendererRegistry,
    core,
    localRepo,
    providedCore: Boolean(providedCore),
    desiredInitialSize,
    initialSize,
    backgroundColor: options.backgroundColor ?? "#ffffff",
    deviceTag,
    initialCatalogDocUrl,
    sizingPolicy: {
      hasExplicitSize,
      getExplicitSize,
      resolvePageSize: resolveCurrentPageSize,
    },
    prepareDocumentOpen,
  };
}
