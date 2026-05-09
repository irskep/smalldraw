import "@smalldraw/design-system/styles.css";
import type { DocumentId } from "@automerge/automerge-repo";
import {
  createModalDialogView as createDesignSystemModalDialogView,
  createShareQrDialog as createDesignSystemShareQrDialog,
} from "@smalldraw/design-system";
import {
  createSmalldraw,
  type DrawingDocumentSize,
  DrawingStore,
} from "@smalldraw/core";
import { el, mount, unmount } from "redom";
import { createColoringAssetUrlResolver } from "../coloring/assetUrls";
import { createQrCodeDataUrl } from "../controller/createQrCodeDataUrl";
import { createKidsDrawController } from "../controller/KidsDrawController";
import { createCollaborationStatusStore } from "../controller/stores/createCollaborationStatusStore";
import { createUiIntentStore } from "../controller/stores/createUiIntentStore";
import type { KidsDocumentSummary } from "../documents";
import {
  automergeUrlToDocumentId,
  buildJoinedCatalogDocUrl,
  createCollaborativeDocumentIndex,
  createLocalDocumentBackend,
  createLocalSmalldrawRepo,
  isCollaborativeDocument,
  type KidsDocumentBackend,
  type LocalSmalldrawRepo,
  resolveDocumentOpenUrl,
  resolveJoinBaseUrl,
} from "../documents";
import { resolveLayoutMode, resolvePageSize } from "../layout/responsiveLayout";
import { createRasterPipeline } from "../render/createRasterPipeline";
import { createKidsShapeRendererRegistry } from "../render/kidsShapeRendererRegistry";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import { configureRasterImageSourceResolver } from "../shapes/rasterImageCache";
import {
  createKidsToolCatalog,
  getDefaultToolIdForFamily,
  getFamilyIdForTool,
  getToolStyleSupport,
} from "../tools/kidsTools";
import { warmImageStampAssets } from "../tools/stamps/imageStampAssets";
import { getImageStampAssets } from "../tools/stamps/imageStampCatalog";
import { createToolbarUiStore } from "../ui/stores/toolbarUiStore";
import { DesignSystemKidsDrawToolbarView } from "../designSystem/DesignSystemKidsDrawToolbar";
import { KidsDrawStageView } from "../view/KidsDrawStage";
import {
  type KidsDrawToolbar,
} from "../view/KidsDrawToolbar";
import {
  type ShareQrDialog,
} from "../view/ShareQrDialog";
import {
  createMultiplayerApiClient,
  type MultiplayerApiClient,
} from "./createMultiplayerApiClient";
import { installMobileGestureGuards } from "./installMobileGestureGuards";
import type {
  KidsDrawApp,
  KidsDrawAppCommands,
  KidsDrawAppOptions,
} from "./types";

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 600;

type ConfirmDialogViewLike = {
  readonly el: HTMLDivElement;
  showConfirm(input: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: "default" | "danger";
    icon?: import("lucide").IconNode;
  }): Promise<boolean>;
  onunmount(): void;
};

export async function createKidsDrawApp(
  options: KidsDrawAppOptions,
): Promise<KidsDrawApp> {
  const uninstallMobileGestureGuards = installMobileGestureGuards();
  configureRasterImageSourceResolver(
    createColoringAssetUrlResolver(options.assetBaseUrl),
  );
  warmImageStampAssets(getImageStampAssets().map((asset) => asset.src));

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
    kind: "open-last-local",
  };
  const deviceTag = options.multiplayer?.deviceTag ?? "unknown-device";
  const startupPreImports: Array<{ binary: Uint8Array; docId: string }> = [];
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

  switch (startupIntent.kind) {
    case "open-local-document": {
      const existing = await documentBackend.getDocument(startupIntent.docUrl);
      if (!existing) {
        if (syncedAccountDocument) {
          const resolved = multiplayerApiClient
            ? await resolveAccountDocumentForLocalOpen({
                documentBackend,
                multiplayerApiClient,
                localRepo: null,
                deviceTag,
                summary: syncedAccountDocument,
              })
            : null;
          if (resolved) {
            startupPreImports.push({
              binary: resolved.binary,
              docId: resolved.collabDocUrl,
            });
            break;
          }
        }
        throw new Error("This drawing is not stored in this browser.");
      }
      await documentBackend.setCurrentDocument(startupIntent.docUrl);
      break;
    }
    case "open-share-link": {
      if (!multiplayerApiClient) {
        throw new Error("Multiplayer API is not configured.");
      }
      const resolved =
        await multiplayerApiClient.resolveCollaborativeDocumentByJoinSecret(
          startupIntent.joinSecret,
          deviceTag,
        );
      if (!resolved) {
        throw new Error("Invalid share link.");
      }
      startupPreImports.push({
        binary: base64ToUint8Array(resolved.content),
        docId: resolved.collabDocUrl,
      });
      const existingSummaries = await documentBackend.listDocuments();
      const existingSummary = existingSummaries.find(
        (summary) => summary.collabDocUrl === resolved.collabDocUrl,
      );
      const catalogDocUrl =
        existingSummary?.docUrl ??
        buildJoinedCatalogDocUrl(resolved.collabDocUrl);
      await documentBackend.createDocument({
        docUrl: catalogDocUrl,
        collaborative: true,
        collabDocUrl: resolved.collabDocUrl,
        joinSecret: resolved.joinSecret,
        accessToken: resolved.accessToken,
        accessTokenScope: resolved.accessTokenScope,
      });
      await documentBackend.setCurrentDocument(catalogDocUrl);
      break;
    }
    case "open-account-document": {
      if (!multiplayerApiClient) {
        throw new Error("Multiplayer API is not configured.");
      }
      const resolved =
        await multiplayerApiClient.resolveCollaborativeDocumentByAccountDocumentId(
          startupIntent.documentId,
          deviceTag,
        );
      startupPreImports.push({
        binary: base64ToUint8Array(resolved.content),
        docId: resolved.collabDocUrl,
      });
      const existingSummaries = await documentBackend.listDocuments();
      const existingSummary = existingSummaries.find(
        (summary) => summary.collabDocUrl === resolved.collabDocUrl,
      );
      const catalogDocUrl =
        existingSummary?.docUrl ??
        buildJoinedCatalogDocUrl(resolved.collabDocUrl);
      await documentBackend.createDocument({
        docUrl: catalogDocUrl,
        collaborative: true,
        collabDocUrl: resolved.collabDocUrl,
        accessToken: resolved.accessToken,
        accessTokenScope: resolved.accessTokenScope,
        accountAttached: true,
      });
      await documentBackend.setCurrentDocument(catalogDocUrl);
      break;
    }
    case "open-last-local": {
      if (syncedAccountDocument && multiplayerApiClient) {
        const resolved = await resolveAccountDocumentForLocalOpen({
          documentBackend,
          multiplayerApiClient,
          localRepo: null,
          deviceTag,
          summary: syncedAccountDocument,
        });
        if (resolved) {
          startupPreImports.push({
            binary: resolved.binary,
            docId: resolved.collabDocUrl,
          });
        }
      }
      break;
    }
  }

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
  let localRepo: LocalSmalldrawRepo | null = null;
  let core = providedCore;
  if (!core) {
    localRepo = createLocalSmalldrawRepo({
      websocketUrl: options.multiplayer?.syncServerWebSocketUrl,
      websocketAuthToken: startupWebsocketToken ?? undefined,
      websocketAuthorizedDocumentId:
        startupAuthorizedCollaborativeDocumentId ?? undefined,
      isCollaborativeDocumentId: async (documentId: string) => {
        const resolvedId = resolveCollaborativeDocumentId(documentId);
        const allowed =
          await collaborativeDocumentIndex.hasDocumentId(resolvedId);
        console.info("[kids-draw:multiplayer] collaborative id lookup", {
          documentId,
          resolvedId,
          allowed,
        });
        return allowed;
      },
      onWebsocketConnectedChange: (connected) => {
        collaborationStatusStore.setWebsocketConnected(connected);
      },
    });
    core = await createSmalldraw({
      repo: localRepo,
      preImports: startupPreImports,
      persistence: {
        mode: "reuse",
        getCurrentDocUrl: async () => {
          const currentCatalogDocUrl =
            await documentBackend.getCurrentDocument();
          if (!currentCatalogDocUrl) {
            return null;
          }
          const summary =
            await documentBackend.getDocument(currentCatalogDocUrl);
          return resolveDocumentOpenUrl(currentCatalogDocUrl, summary);
        },
        setCurrentDocUrl: (url) => documentBackend.setCurrentDocument(url),
      },
      documentSize: desiredInitialSize,
      shapeHandlers,
    });
  }

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

  const docSize = resolveInitialDocumentSize(
    core.storeAdapter.getDoc(),
    desiredInitialSize,
  );
  const initialSize = {
    width: docSize.width,
    height: docSize.height,
  };

  const backgroundColor = options.backgroundColor ?? "#ffffff";

  const element = el("div.kids-draw-app") as HTMLDivElement;
  element.dataset.runtimeVariant = "design-system";

  const catalog = createKidsToolCatalog(shapeRendererRegistry);
  const uiIntentStore = createUiIntentStore();

  const toolbar: KidsDrawToolbar = new DesignSystemKidsDrawToolbarView({
    tools: catalog.tools,
    families: catalog.families,
    sidebarItems: catalog.sidebarItems,
    uiIntentStore,
  });
  const stage = new KidsDrawStageView({
    width: initialSize.width,
    height: initialSize.height,
    backgroundColor,
    uiIntentStore,
  });
  const modalDialog: ConfirmDialogViewLike = createDesignSystemModalDialogView();
  const shareQrDialog: ShareQrDialog = createDesignSystemShareQrDialog();

  const uploadAccountThumbnail = async (
    summary: KidsDocumentSummary | null,
    thumbnail: Blob,
  ): Promise<void> => {
    if (!multiplayerApiClient) {
      return;
    }
    if (!isCollaborativeDocument(summary)) {
      return;
    }
    const isAttached =
      summary.accountAttached || summary.accessTokenScope === "owner";
    if (!isAttached) {
      return;
    }
    const documentId = resolveCollaborativeDocumentId(summary.collabDocUrl);
    try {
      console.info("[kids-draw:documents] account thumbnail upload start", {
        docUrl: summary.docUrl,
        documentId,
        sizeBytes: thumbnail.size,
        type: thumbnail.type || "application/octet-stream",
      });
      await multiplayerApiClient.uploadDocumentThumbnail(documentId, thumbnail);
      console.info("[kids-draw:documents] account thumbnail upload complete", {
        docUrl: summary.docUrl,
        documentId,
      });
    } catch (error) {
      console.warn("[kids-draw:documents] account thumbnail upload failed", {
        docUrl: summary.docUrl,
        documentId,
        error,
      });
    }
  };

  toolbar.setCanvasContent(stage.element);
  mount(element, toolbar.el);
  mount(element, modalDialog.el);
  mount(element, shareQrDialog.el);
  mount(options.container, element);

  const store = new DrawingStore({
    tools: catalog.tools.map((tool) => tool.tool),
    document: core.storeAdapter.getDoc(),
    actionDispatcher: (event) => core.storeAdapter.applyAction(event),
    shapeHandlers,
  });
  store.activateTool(
    getDefaultToolIdForFamily(catalog.defaultFamilyId, catalog),
  );
  const toolbarUiStore = createToolbarUiStore();
  toolbarUiStore.syncFromDrawingStore(store, {
    resolveActiveFamilyId: (toolId) => getFamilyIdForTool(toolId, catalog),
    resolveToolStyleSupport: (toolId) => getToolStyleSupport(toolId, catalog),
  });
  const unbindToolbarUi = toolbar.bindUiState(toolbarUiStore.$state);

  const pipeline = createRasterPipeline({
    store,
    stage,
    shapeRendererRegistry,
    width: initialSize.width,
    height: initialSize.height,
    backgroundColor,
    tilePixelRatio:
      typeof globalThis.devicePixelRatio === "number"
        ? globalThis.devicePixelRatio
        : 1,
    renderIdentity: "kids-draw-init",
  });

  pipeline.bakeInitialShapes(Object.values(store.getDocument().shapes));

  const controller = createKidsDrawController({
    store,
    core,
    toolbar,
    catalog,
    shapeRendererRegistry,
    tools: catalog.tools,
    families: catalog.families,
    uiIntentStore,
    stage,
    toolbarUiStore,
    pipeline,
    appElement: element,
    documentBackend,
    collaborationStatusStore: {
      setCurrentDocument(summary) {
        collaborationStatusStore.setCurrentDocument(summary);
        collaborativeDocumentIndex.upsertSummary(summary);
        updateRepoWebsocketAuthorization(localRepo, summary);
      },
      subscribe(listener) {
        return collaborationStatusStore.subscribe(listener);
      },
      getStatus() {
        return collaborationStatusStore.getStatus();
      },
    },
    backgroundColor,
    initialSize,
    sizingPolicy: {
      hasExplicitSize,
      getExplicitSize,
      resolvePageSize: resolveCurrentPageSize,
    },
    providedCore: Boolean(providedCore),
    confirmDestructiveAction:
      options.confirmDestructiveAction ??
      ((dialog) => modalDialog.showConfirm(dialog)),
    savePngExport: options.savePngExport,
    createDocumentCopy: multiplayerApiClient
      ? () => core.createDocumentCopy()
      : undefined,
    registerCollaborativeDocument: multiplayerApiClient
      ? async (documentId: string, content: Uint8Array) => {
          console.info("[kids-draw:multiplayer] share upgrade: register start");
          const result =
            await multiplayerApiClient.registerCollaborativeDocument(
              documentId,
              content,
              deviceTag,
            );
          console.info(
            "[kids-draw:multiplayer] share upgrade: register success",
            {
              documentId,
              joinSecret: result.joinSecret,
              accessToken: result.accessToken,
            },
          );
          if (localRepo) {
            localRepo.setWebsocketAuthorizedDocumentId(
              resolveCollaborativeDocumentId(documentId),
            );
            localRepo.setWebsocketAuthToken(result.accessToken);
          }
          return result;
        }
      : undefined,
    claimCollaborativeDocument: multiplayerApiClient
      ? async (accessToken: string) => {
          await multiplayerApiClient.claimCollaborativeDocument(accessToken);
        }
      : undefined,
    uploadDocumentThumbnail: async (document, thumbnail) => {
      await uploadAccountThumbnail(document, thumbnail);
    },
    onThumbnailSaved: async (docUrl, thumbnail) => {
      const summary = await documentBackend.getDocument(docUrl);
      await uploadAccountThumbnail(summary, thumbnail);
    },
    initialCatalogDocUrl: initialCatalogDocUrl ?? undefined,
    beforeOpenDocument: prepareDocumentOpen,
    resolveJoinBaseUrl: () =>
      resolveJoinBaseUrl(options.multiplayer?.joinBaseUrl),
    showShareDialog: async (payload) => {
      const qrDataUrl = await createQrCodeDataUrl(payload.joinUrl);
      await shareQrDialog.show({
        joinUrl: payload.joinUrl,
        qrDataUrl,
      });
    },
    onShareError:
      options.onShareError ??
      ((message) => {
        void modalDialog.showConfirm({
          title: "Unable to share drawing",
          message,
          confirmLabel: "OK",
          cancelLabel: "Dismiss",
        });
      }),
    onClaimError: (message) => {
      void modalDialog.showConfirm({
        title: "Unable to claim drawing",
        message,
        confirmLabel: "OK",
        cancelLabel: "Dismiss",
      });
    },
    onCurrentDocumentSummaryChanged: options.onCurrentDocumentSummaryChanged,
  });

  const commands: KidsDrawAppCommands = {
    undo(): void {
      uiIntentStore.publish({ type: "undo" });
    },
    redo(): void {
      uiIntentStore.publish({ type: "redo" });
    },
    clear(): void {
      uiIntentStore.publish({ type: "clear" });
    },
    export(): void {
      uiIntentStore.publish({ type: "export" });
    },
    newDrawing(): void {
      uiIntentStore.publish({ type: "new_drawing" });
    },
    browse(): void {
      uiIntentStore.publish({ type: "browse" });
    },
    share(): void {
      uiIntentStore.publish({ type: "share" });
    },
  };

  return {
    element,
    store,
    overlay: stage.overlay,
    core,
    commands,
    destroy() {
      controller.destroy();
      unbindToolbarUi();
      modalDialog.onunmount();
      shareQrDialog.onunmount();
      unmount(options.container, element);
      uninstallMobileGestureGuards();
    },
  };
}

export function resolveStartupWebsocketToken(
  initialCatalogSummary: Pick<KidsDocumentSummary, "accessToken"> | null,
): string | null {
  return initialCatalogSummary?.accessToken ?? null;
}

export function resolveCollaborativeDocumentId(documentId: string): string {
  return automergeUrlToDocumentId(documentId) ?? documentId;
}

export function resolveAuthorizedCollaborativeDocumentId(
  websocketToken: string | null,
  initialCatalogSummary: Pick<
    KidsDocumentSummary,
    "collabDocUrl" | "collaborative"
  > | null,
): string | null {
  if (!websocketToken) {
    return null;
  }
  if (
    !initialCatalogSummary?.collaborative ||
    !initialCatalogSummary.collabDocUrl
  ) {
    return null;
  }
  return resolveCollaborativeDocumentId(initialCatalogSummary.collabDocUrl);
}

export function resolveInitialDocumentSize(
  doc: { size?: { width?: unknown; height?: unknown } } | null | undefined,
  fallbackSize: DrawingDocumentSize,
): DrawingDocumentSize {
  const width = doc?.size?.width;
  const height = doc?.size?.height;
  if (
    typeof width === "number" &&
    Number.isFinite(width) &&
    width > 0 &&
    typeof height === "number" &&
    Number.isFinite(height) &&
    height > 0
  ) {
    return { width, height };
  }
  return {
    width: Math.max(1, Math.round(fallbackSize.width)),
    height: Math.max(1, Math.round(fallbackSize.height)),
  };
}

async function syncAccountCatalog(options: {
  documentBackend: KidsDocumentBackend;
  multiplayerApiClient: MultiplayerApiClient | null;
  selectFirstIfNoCurrent: boolean;
}): Promise<KidsDocumentSummary | null> {
  if (!options.multiplayerApiClient) {
    return null;
  }
  const existingDocuments = await options.documentBackend.listDocuments();
  const existingCurrentDocUrl =
    await options.documentBackend.getCurrentDocument();
  const existingCurrentDocument = existingCurrentDocUrl
    ? await options.documentBackend.getDocument(existingCurrentDocUrl)
    : null;
  const existingByCollabDocUrl = new Map(
    existingDocuments
      .filter(isCollaborativeDocument)
      .map((document) => [document.collabDocUrl, document] as const),
  );

  let accountDocuments: Awaited<
    ReturnType<MultiplayerApiClient["listAccountCollaborativeDocuments"]>
  >;
  try {
    accountDocuments =
      await options.multiplayerApiClient.listAccountCollaborativeDocuments();
  } catch (error) {
    console.info("[kids-draw:documents] account catalog sync skipped", {
      reason: "account_unavailable",
      error,
    });
    return null;
  }

  let selectedDocument: KidsDocumentSummary | null = null;
  for (const accountDocument of accountDocuments) {
    const collabDocUrl = `automerge:${accountDocument.documentId}`;
    const catalogDocUrl =
      existingByCollabDocUrl.get(collabDocUrl)?.docUrl ??
      buildJoinedCatalogDocUrl(collabDocUrl);
    const summary = await options.documentBackend.createDocument({
      docUrl: catalogDocUrl,
      title: accountDocument.name,
      collaborative: true,
      collabDocUrl,
      accountAttached: true,
      remoteThumbnailUrl: accountDocument.thumbnailUrl ?? undefined,
    });
    selectedDocument ??= summary;
  }

  if (
    options.selectFirstIfNoCurrent &&
    !existingCurrentDocument &&
    selectedDocument
  ) {
    await options.documentBackend.setCurrentDocument(selectedDocument.docUrl);
  }
  if (existingCurrentDocument) {
    return existingCurrentDocument;
  }
  return selectedDocument;
}

async function resolveAccountDocumentForLocalOpen(options: {
  documentBackend: KidsDocumentBackend;
  multiplayerApiClient: MultiplayerApiClient;
  localRepo: LocalSmalldrawRepo | null;
  deviceTag: string;
  summary: KidsDocumentSummary | null;
}): Promise<{ binary: Uint8Array; collabDocUrl: string } | null> {
  const summary = options.summary;
  if (!summary?.accountAttached || !isCollaborativeDocument(summary)) {
    return null;
  }

  const documentId = resolveCollaborativeDocumentId(summary.collabDocUrl);
  try {
    const resolved =
      await options.multiplayerApiClient.resolveCollaborativeDocumentByAccountDocumentId(
        documentId,
        options.deviceTag,
      );
    const binary = base64ToUint8Array(resolved.content);
    const automergeDocumentId = documentId as DocumentId;
    options.localRepo?.setWebsocketAuthorizedDocumentId(documentId);
    options.localRepo?.setWebsocketAuthToken(resolved.accessToken);
    if (options.localRepo && !options.localRepo.handles[automergeDocumentId]) {
      options.localRepo.import(binary, { docId: automergeDocumentId });
    }
    await options.documentBackend.createDocument({
      docUrl: summary.docUrl,
      title: summary.title,
      collaborative: true,
      collabDocUrl: resolved.collabDocUrl,
      accessToken: resolved.accessToken,
      accessTokenScope: resolved.accessTokenScope,
      accountAttached: true,
    });
    return { binary, collabDocUrl: resolved.collabDocUrl };
  } catch (error) {
    console.warn("[kids-draw:documents] failed to resolve account document", {
      documentId,
      error,
    });
    return null;
  }
}

function updateRepoWebsocketAuthorization(
  localRepo: LocalSmalldrawRepo | null,
  summary: KidsDocumentSummary | null,
): void {
  if (!localRepo) {
    return;
  }
  if (!summary?.accessToken || !isCollaborativeDocument(summary)) {
    localRepo.setWebsocketAuthorizedDocumentId(null);
    localRepo.setWebsocketAuthToken(null);
    return;
  }
  localRepo.setWebsocketAuthorizedDocumentId(
    resolveCollaborativeDocumentId(summary.collabDocUrl),
  );
  localRepo.setWebsocketAuthToken(summary.accessToken);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
