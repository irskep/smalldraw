import "@smalldraw/design-system/styles.css";
import { DrawingStore } from "@smalldraw/core";
import type {
  ParentalControlsDialog,
  SplatContextDocumentSlot,
} from "@smalldraw/design-system";
import {
  applyParentalControlsSettingsResult,
  createParentalControlsAccessOptions,
  loadParentalControlsState,
  subscribeToParentalControlsState,
} from "@smalldraw/shared";
import { createColoringAssetUrlResolver } from "../coloring/assetUrls";
import { createQrCodeDataUrl } from "../controller/createQrCodeDataUrl";
import { createKidsDrawController } from "../controller/KidsDrawController";
import type { KidsDrawUiIntent } from "../controller/KidsDrawUiIntent";
import type { createCollaborationStatusStore } from "../controller/stores/createCollaborationStatusStore";
import type { UiIntentStore } from "../controller/stores/createUiIntentStore";
import type { KidsDocumentSummary } from "../documents";
import {
  type createCollaborativeDocumentIndex,
  isCollaborativeDocument,
  type KidsDocumentBackend,
  resolveJoinBaseUrl,
} from "../documents";
import { resolvePageSize } from "../layout/responsiveLayout";
import { createRasterPipeline } from "../render/createRasterPipeline";
import { createKidsShapeRendererRegistry } from "../render/kidsShapeRendererRegistry";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import { configureRasterImageSourceResolver } from "../shapes/rasterImageCache";
import {
  createKidsToolCatalog,
  getDefaultToolIdForFamily,
  getToolStyleSupport,
} from "../tools/kidsTools";
import { warmImageStampAssets } from "../tools/stamps/imageStampAssets";
import { getImageStampAssets } from "../tools/stamps/imageStampCatalog";
import { createToolbarUiStore } from "../ui/stores/toolbarUiStore";
import {
  bindCollaborativeSyncErrorSurface,
  isSyncIssueShareMessage,
} from "./collaborativeSyncErrorSurface";
import type { MultiplayerApiClient } from "./createMultiplayerApiClient";
import {
  resolveCollaborativeDocumentId,
  updateRepoWebsocketAuthorization,
} from "./documentBootstrap";
import { installMobileGestureGuards } from "./installMobileGestureGuards";
import { createPresentationRuntime } from "./presentationRuntime";
import { type AppRuntimeAssembly, assembleAppRuntime } from "./runtimeAssembly";
import type { bootstrapKidsDrawRuntime } from "./runtimeBootstrap";
import type {
  KidsDrawApp,
  KidsDrawAppCommands,
  KidsDrawAppOptions,
} from "./types";

export async function createKidsDrawApp(
  options: KidsDrawAppOptions,
): Promise<KidsDrawApp> {
  const uninstallMobileGestureGuards = installMobileGestureGuards();
  const resolveAssetUrl = createColoringAssetUrlResolver(options.assetBaseUrl);
  configureRasterImageSourceResolver(resolveAssetUrl);
  warmImageStampAssets(getImageStampAssets().map((asset) => asset.src));
  const provisionalShapeHandlers = createKidsShapeHandlerRegistry();
  const provisionalShapeRendererRegistry = createKidsShapeRendererRegistry();
  const provisionalCatalog = createKidsToolCatalog(
    provisionalShapeRendererRegistry,
  );
  const provisionalSize = resolveInitialShellSize(options);
  const provisionalBackgroundColor = options.backgroundColor ?? "#ffffff";
  const presentation = createPresentationRuntime({
    container: options.container,
    tools: provisionalCatalog.tools,
    families: provisionalCatalog.families,
    sidebarItems: provisionalCatalog.sidebarItems,
    width: provisionalSize.width,
    height: provisionalSize.height,
    backgroundColor: provisionalBackgroundColor,
  });
  const toolbarUiStore = createToolbarUiStore();
  const unbindToolbarUi = presentation.toolbar.bindUiState(
    toolbarUiStore.$state,
  );
  const syncParentalControlsVisibility = (): void => {
    presentation.toolbar.setSharingFeaturesVisible(
      !loadParentalControlsState().sharingHidden,
    );
  };
  syncParentalControlsVisibility();
  const unbindParentalControls = subscribeToParentalControlsState(
    syncParentalControlsVisibility,
  );
  presentation.stage.setCanvasVisible(true);
  presentation.stage.setInteractionEnabled(false);
  presentation.toolbar.setDocumentSlot(describeInitialBlockingState(options));

  let runtime: AppRuntimeAssembly;
  try {
    runtime = await assembleAppRuntime(options, {
      shapeHandlers: provisionalShapeHandlers,
      shapeRendererRegistry: provisionalShapeRendererRegistry,
    });
  } catch (error) {
    unbindParentalControls();
    presentation.destroy();
    uninstallMobileGestureGuards();
    throw error;
  }

  const catalog = createKidsToolCatalog(runtime.shapeRendererRegistry);
  const uploadAccountThumbnail = createAccountThumbnailUploader({
    multiplayerApiClient: runtime.multiplayerApiClient,
  });
  const controllerCollaborationStatusStore =
    createControllerCollaborationStatusStore({
      collaborationStatusStore: runtime.collaborationStatusStore,
      collaborativeDocumentIndex: runtime.collaborativeDocumentIndex,
      localRepo: runtime.localRepo,
    });
  if (runtime.initialCatalogDocUrl) {
    controllerCollaborationStatusStore.setCurrentDocument(
      await runtime.documentBackend.getDocument(runtime.initialCatalogDocUrl),
    );
  }
  const controllerMultiplayerAdapters = createControllerMultiplayerAdapters({
    multiplayerApiClient: runtime.multiplayerApiClient,
    core: runtime.core,
    deviceTag: runtime.deviceTag,
    localRepo: runtime.localRepo,
    documentBackend: runtime.documentBackend,
    uploadAccountThumbnail,
    presentation,
    appOptions: options,
    collaborationStatusStore: runtime.collaborationStatusStore,
  });
  const unbindCollaborativeSyncErrorSurface = bindCollaborativeSyncErrorSurface(
    {
      windowTarget: window,
      collaborationStatusStore: runtime.collaborationStatusStore,
    },
  );

  const store = new DrawingStore({
    tools: catalog.tools.map((tool) => tool.tool),
    document: runtime.core.storeAdapter.getDoc(),
    actionDispatcher: (event) => runtime.core.storeAdapter.applyAction(event),
    shapeHandlers: runtime.shapeHandlers,
  });
  store.activateTool(
    getDefaultToolIdForFamily(catalog.defaultFamilyId, catalog),
  );
  toolbarUiStore.syncFromDrawingStore(store, {
    resolveToolStyleSupport: (toolId) => getToolStyleSupport(toolId, catalog),
  });

  const pipeline = createRasterPipeline({
    store,
    stage: presentation.stage,
    shapeRendererRegistry: runtime.shapeRendererRegistry,
    width: runtime.initialSize.width,
    height: runtime.initialSize.height,
    backgroundColor: runtime.backgroundColor,
    tilePixelRatio:
      typeof globalThis.devicePixelRatio === "number"
        ? globalThis.devicePixelRatio
        : 1,
    renderIdentity: "kids-draw-init",
  });
  presentation.stage.setSceneDimensions(
    runtime.initialSize.width,
    runtime.initialSize.height,
  );

  pipeline.bakeInitialShapes(Object.values(store.getDocument().shapes));

  const controller = createKidsDrawController({
    store,
    core: runtime.core,
    toolbar: presentation.toolbar,
    catalog,
    shapeRendererRegistry: runtime.shapeRendererRegistry,
    tools: catalog.tools,
    families: catalog.families,
    uiIntentStore: presentation.uiIntentStore,
    stage: presentation.stage,
    toolbarUiStore,
    pipeline,
    appElement: presentation.element,
    documentBackend: runtime.documentBackend,
    resolveAssetUrl,
    collaborationStatusStore: controllerCollaborationStatusStore,
    backgroundColor: runtime.backgroundColor,
    initialSize: runtime.initialSize,
    sizingPolicy: runtime.sizingPolicy,
    providedCore: runtime.providedCore,
    confirmDestructiveAction:
      options.confirmDestructiveAction ??
      ((dialog) => presentation.modalDialog.showConfirm(dialog)),
    savePngExport: options.savePngExport,
    createDocumentCopy: controllerMultiplayerAdapters.createDocumentCopy,
    registerCollaborativeDocument:
      controllerMultiplayerAdapters.registerCollaborativeDocument,
    claimCollaborativeDocument:
      controllerMultiplayerAdapters.claimCollaborativeDocument,
    deleteCollaborativeDocument:
      controllerMultiplayerAdapters.deleteCollaborativeDocument,
    uploadDocumentThumbnail:
      controllerMultiplayerAdapters.uploadDocumentThumbnail,
    onThumbnailSaved: controllerMultiplayerAdapters.onThumbnailSaved,
    initialCatalogDocUrl: runtime.initialCatalogDocUrl ?? undefined,
    initialDocumentAccessState: runtime.initialDocumentAccessState ?? undefined,
    startupCreateNewDocument: runtime.startupCreateNewDocument,
    beforeOpenDocument: runtime.prepareDocumentOpen,
    resolveJoinBaseUrl: () =>
      resolveJoinBaseUrl(options.multiplayer?.joinBaseUrl),
    showShareDialog: controllerMultiplayerAdapters.showShareDialog,
    isSharingAllowed: () => !loadParentalControlsState().sharingHidden,
    requestSharePermission: async () =>
      await requestParentalSharePermission(presentation.parentalControlsDialog),
    onShareError: controllerMultiplayerAdapters.onShareError,
    onClaimError: controllerMultiplayerAdapters.onClaimError,
    onDocumentOpenRequested: options.onDocumentOpenRequested,
    onCurrentDocumentSummaryChanged: options.onCurrentDocumentSummaryChanged,
  });

  const commands = {
    ...createUiIntentCommands(presentation.uiIntentStore),
    openDocument: (docUrl: string) => controller.openDocument(docUrl),
  };

  return {
    element: presentation.element,
    store,
    overlay: presentation.stage.overlay,
    core: runtime.core,
    commands,
    destroy() {
      controller.destroy();
      unbindToolbarUi();
      unbindParentalControls();
      unbindCollaborativeSyncErrorSurface();
      presentation.destroy();
      uninstallMobileGestureGuards();
    },
  };
}

async function requestParentalSharePermission(
  dialog: ParentalControlsDialog,
): Promise<boolean> {
  const state = loadParentalControlsState();
  if (state.sharingHidden) {
    return false;
  }
  if (state.promptSeen) {
    return true;
  }
  const result = await dialog.show(createParentalControlsAccessOptions());
  if (!result) {
    return false;
  }
  await applyParentalControlsSettingsResult(result);
  return true;
}

function resolveInitialShellSize(
  options: Pick<KidsDrawAppOptions, "width" | "height">,
): { width: number; height: number } {
  const explicitWidth = options.width ?? 960;
  const explicitHeight = options.height ?? 600;
  if (options.width !== undefined || options.height !== undefined) {
    return { width: explicitWidth, height: explicitHeight };
  }
  return resolvePageSize({ width: explicitWidth, height: explicitHeight });
}

function describeInitialBlockingState(
  options: Pick<KidsDrawAppOptions, "multiplayer">,
): SplatContextDocumentSlot {
  const startupIntent = options.multiplayer?.startupIntent;
  if (startupIntent?.kind === "create-new-document") {
    return {
      type: "loading",
      title: "Creating drawing…",
      description: "Preparing a blank drawing.",
      recoveryActions: "none",
    };
  }
  if (startupIntent?.kind === "open-account-document") {
    return {
      type: "loading",
      title: "Opening drawing…",
      description: "Loading the requested shared drawing.",
      recoveryActions: "none",
    };
  }
  if (startupIntent?.kind === "open-share-link") {
    return {
      type: "loading",
      title: "Opening shared drawing…",
      description: "Loading the shared drawing from its invite link.",
      recoveryActions: "none",
    };
  }
  if (startupIntent?.kind === "open-local-document") {
    return {
      type: "loading",
      title: "Opening drawing…",
      description: "Loading the requested drawing from this browser.",
      recoveryActions: "none",
    };
  }
  return {
    type: "loading",
    title: "Loading drawing…",
    description: "Preparing the drawing surface.",
    recoveryActions: "none",
  };
}

function createUiIntentCommands(
  uiIntentStore: Pick<UiIntentStore, "publish">,
): Omit<KidsDrawAppCommands, "openDocument"> {
  const publish = <
    TType extends Extract<
      KidsDrawUiIntent["type"],
      "undo" | "redo" | "clear" | "export" | "new_drawing" | "browse" | "share"
    >,
  >(
    type: TType,
  ): void => {
    uiIntentStore.publish({
      type,
    } as Extract<KidsDrawUiIntent, { type: TType }>);
  };

  return {
    undo: () => publish("undo"),
    redo: () => publish("redo"),
    clear: () => publish("clear"),
    export: () => publish("export"),
    newDrawing: () => publish("new_drawing"),
    browse: () => publish("browse"),
    share: () => publish("share"),
  };
}

function createControllerCollaborationStatusStore(options: {
  collaborationStatusStore: ReturnType<typeof createCollaborationStatusStore>;
  collaborativeDocumentIndex: ReturnType<
    typeof createCollaborativeDocumentIndex
  >;
  localRepo: Awaited<ReturnType<typeof bootstrapKidsDrawRuntime>>["localRepo"];
}): Parameters<typeof createKidsDrawController>[0]["collaborationStatusStore"] {
  return {
    setCurrentDocument(summary) {
      options.collaborationStatusStore.setCurrentDocument(summary);
      options.collaborativeDocumentIndex.upsertSummary(summary);
      updateRepoWebsocketAuthorization(options.localRepo, summary);
    },
    subscribe(listener) {
      return options.collaborationStatusStore.subscribe(listener);
    },
    getStatus() {
      return options.collaborationStatusStore.getStatus();
    },
  };
}

function createControllerMultiplayerAdapters(options: {
  multiplayerApiClient: MultiplayerApiClient | null;
  core: Awaited<ReturnType<typeof bootstrapKidsDrawRuntime>>["core"];
  deviceTag: string;
  localRepo: Awaited<ReturnType<typeof bootstrapKidsDrawRuntime>>["localRepo"];
  documentBackend: KidsDocumentBackend;
  uploadAccountThumbnail: ReturnType<typeof createAccountThumbnailUploader>;
  presentation: ReturnType<typeof createPresentationRuntime>;
  appOptions: KidsDrawAppOptions;
  collaborationStatusStore: ReturnType<typeof createCollaborationStatusStore>;
}): Pick<
  Parameters<typeof createKidsDrawController>[0],
  | "createDocumentCopy"
  | "registerCollaborativeDocument"
  | "claimCollaborativeDocument"
  | "deleteCollaborativeDocument"
  | "removeCollaborativeDocumentFromAccount"
  | "uploadDocumentThumbnail"
  | "onThumbnailSaved"
  | "showShareDialog"
  | "onShareError"
  | "onClaimError"
> {
  const multiplayerApiClient = options.multiplayerApiClient;

  return {
    createDocumentCopy: multiplayerApiClient
      ? () => options.core.createDocumentCopy()
      : undefined,
    registerCollaborativeDocument: multiplayerApiClient
      ? async (documentId: string, content: Uint8Array) => {
          console.info("[kids-draw:multiplayer] share upgrade: register start");
          const result =
            await multiplayerApiClient.registerCollaborativeDocument(
              documentId,
              content,
              options.deviceTag,
            );
          console.info(
            "[kids-draw:multiplayer] share upgrade: register success",
            {
              documentId,
              joinSecret: result.joinSecret,
              accessToken: result.accessToken,
            },
          );
          if (options.localRepo) {
            options.localRepo.setWebsocketAuthorizedDocumentId(
              resolveCollaborativeDocumentId(documentId),
            );
            options.localRepo.setWebsocketAuthToken(result.accessToken);
          }
          return result;
        }
      : undefined,
    claimCollaborativeDocument: multiplayerApiClient
      ? async (accessToken: string) => {
          await multiplayerApiClient.claimCollaborativeDocument(accessToken);
        }
      : undefined,
    deleteCollaborativeDocument: multiplayerApiClient
      ? async (documentId: string) => {
          await multiplayerApiClient.deleteCollaborativeDocument(documentId);
        }
      : undefined,
    removeCollaborativeDocumentFromAccount: multiplayerApiClient
      ? async (documentId: string) => {
          await multiplayerApiClient.removeCollaborativeDocumentFromAccount(
            documentId,
          );
        }
      : undefined,
    uploadDocumentThumbnail: async (document, thumbnail) => {
      await options.uploadAccountThumbnail(document, thumbnail);
    },
    onThumbnailSaved: async (docUrl, thumbnail) => {
      const summary = await options.documentBackend.getDocument(docUrl);
      await options.uploadAccountThumbnail(summary, thumbnail);
    },
    showShareDialog: async (payload) => {
      const qrDataUrl = await createQrCodeDataUrl(payload.joinUrl);
      await options.presentation.shareQrDialog.show({
        joinUrl: payload.joinUrl,
        qrDataUrl,
      });
    },
    onShareError: (message) => {
      if (isSyncIssueShareMessage(message)) {
        options.collaborationStatusStore.setSyncError(message);
      }
      if (options.appOptions.onShareError) {
        options.appOptions.onShareError(message);
        return;
      }
      void options.presentation.modalDialog.showConfirm({
        title: "Unable to share drawing",
        message,
        confirmLabel: "OK",
        cancelLabel: "Dismiss",
      });
    },
    onClaimError: (message) => {
      void options.presentation.modalDialog.showConfirm({
        title: "Unable to claim drawing",
        message,
        confirmLabel: "OK",
        cancelLabel: "Dismiss",
      });
    },
  };
}

function createAccountThumbnailUploader(options: {
  multiplayerApiClient: MultiplayerApiClient | null;
}): (summary: KidsDocumentSummary | null, thumbnail: Blob) => Promise<void> {
  return async (
    summary: KidsDocumentSummary | null,
    thumbnail: Blob,
  ): Promise<void> => {
    if (!options.multiplayerApiClient) {
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
      await options.multiplayerApiClient.uploadDocumentThumbnail(
        documentId,
        thumbnail,
      );
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
}
