import "@smalldraw/design-system/styles.css";
import { DrawingStore } from "@smalldraw/core";
import { createColoringAssetUrlResolver } from "../coloring/assetUrls";
import { createQrCodeDataUrl } from "../controller/createQrCodeDataUrl";
import { createKidsDrawController } from "../controller/KidsDrawController";
import { createCollaborationStatusStore } from "../controller/stores/createCollaborationStatusStore";
import type { UiIntentStore } from "../controller/stores/createUiIntentStore";
import type { KidsDocumentSummary } from "../documents";
import {
  createCollaborativeDocumentIndex,
  isCollaborativeDocument,
  type KidsDocumentBackend,
  resolveJoinBaseUrl,
} from "../documents";
import { createRasterPipeline } from "../render/createRasterPipeline";
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
  type MultiplayerApiClient,
} from "./createMultiplayerApiClient";
import {
  resolveCollaborativeDocumentId,
  updateRepoWebsocketAuthorization,
} from "./documentBootstrap";
import { installMobileGestureGuards } from "./installMobileGestureGuards";
import {
  createPresentationRuntime,
  type ConfirmDialogViewLike,
} from "./presentationRuntime";
import { bootstrapKidsDrawRuntime } from "./runtimeBootstrap";
import { assembleAppRuntime } from "./runtimeAssembly";
import type { KidsDrawUiIntent } from "../controller/KidsDrawUiIntent";
import type {
  KidsDrawApp,
  KidsDrawAppCommands,
  KidsDrawAppOptions,
} from "./types";

export async function createKidsDrawApp(
  options: KidsDrawAppOptions,
): Promise<KidsDrawApp> {
  const uninstallMobileGestureGuards = installMobileGestureGuards();
  configureRasterImageSourceResolver(
    createColoringAssetUrlResolver(options.assetBaseUrl),
  );
  warmImageStampAssets(getImageStampAssets().map((asset) => asset.src));
  const runtime = await assembleAppRuntime(options);

  const catalog = createKidsToolCatalog(runtime.shapeRendererRegistry);
  const presentation = createPresentationRuntime({
    container: options.container,
    tools: catalog.tools,
    families: catalog.families,
    sidebarItems: catalog.sidebarItems,
    width: runtime.initialSize.width,
    height: runtime.initialSize.height,
    backgroundColor: runtime.backgroundColor,
  });
  const uploadAccountThumbnail = createAccountThumbnailUploader({
    multiplayerApiClient: runtime.multiplayerApiClient,
  });
  const controllerCollaborationStatusStore =
    createControllerCollaborationStatusStore({
      collaborationStatusStore: runtime.collaborationStatusStore,
      collaborativeDocumentIndex: runtime.collaborativeDocumentIndex,
      localRepo: runtime.localRepo,
    });
  const controllerMultiplayerAdapters = createControllerMultiplayerAdapters({
    multiplayerApiClient: runtime.multiplayerApiClient,
    core: runtime.core,
    deviceTag: runtime.deviceTag,
    localRepo: runtime.localRepo,
    documentBackend: runtime.documentBackend,
    uploadAccountThumbnail,
    presentation,
    appOptions: options,
  });

  const store = new DrawingStore({
    tools: catalog.tools.map((tool) => tool.tool),
    document: runtime.core.storeAdapter.getDoc(),
    actionDispatcher: (event) => runtime.core.storeAdapter.applyAction(event),
    shapeHandlers: runtime.shapeHandlers,
  });
  store.activateTool(
    getDefaultToolIdForFamily(catalog.defaultFamilyId, catalog),
  );
  const toolbarUiStore = createToolbarUiStore();
  toolbarUiStore.syncFromDrawingStore(store, {
    resolveToolStyleSupport: (toolId) => getToolStyleSupport(toolId, catalog),
  });
  const unbindToolbarUi = presentation.toolbar.bindUiState(toolbarUiStore.$state);

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
    uploadDocumentThumbnail:
      controllerMultiplayerAdapters.uploadDocumentThumbnail,
    onThumbnailSaved: controllerMultiplayerAdapters.onThumbnailSaved,
    initialCatalogDocUrl: runtime.initialCatalogDocUrl ?? undefined,
    beforeOpenDocument: runtime.prepareDocumentOpen,
    resolveJoinBaseUrl: () =>
      resolveJoinBaseUrl(options.multiplayer?.joinBaseUrl),
    showShareDialog: controllerMultiplayerAdapters.showShareDialog,
    onShareError: controllerMultiplayerAdapters.onShareError,
    onClaimError: controllerMultiplayerAdapters.onClaimError,
    onOpenDocumentError: controllerMultiplayerAdapters.onOpenDocumentError,
    onCurrentDocumentSummaryChanged: options.onCurrentDocumentSummaryChanged,
  });

  const commands = createUiIntentCommands(presentation.uiIntentStore);

  return {
    element: presentation.element,
    store,
    overlay: presentation.stage.overlay,
    core: runtime.core,
    commands,
    destroy() {
      controller.destroy();
      unbindToolbarUi();
      presentation.destroy();
      uninstallMobileGestureGuards();
    },
  };
}

function createUiIntentCommands(
  uiIntentStore: Pick<UiIntentStore, "publish">,
): KidsDrawAppCommands {
  const publish = <TType extends Extract<
    KidsDrawUiIntent["type"],
    "undo" | "redo" | "clear" | "export" | "new_drawing" | "browse" | "share"
  >>(
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
  collaborativeDocumentIndex: ReturnType<typeof createCollaborativeDocumentIndex>;
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
}): Pick<
  Parameters<typeof createKidsDrawController>[0],
  | "createDocumentCopy"
  | "registerCollaborativeDocument"
  | "claimCollaborativeDocument"
  | "uploadDocumentThumbnail"
  | "onThumbnailSaved"
  | "showShareDialog"
  | "onShareError"
  | "onClaimError"
  | "onOpenDocumentError"
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
    onShareError:
      options.appOptions.onShareError ??
      ((message) => {
        void options.presentation.modalDialog.showConfirm({
          title: "Unable to share drawing",
          message,
          confirmLabel: "OK",
          cancelLabel: "Dismiss",
        });
      }),
    onClaimError: (message) => {
      void options.presentation.modalDialog.showConfirm({
        title: "Unable to claim drawing",
        message,
        confirmLabel: "OK",
        cancelLabel: "Dismiss",
      });
    },
    onOpenDocumentError: (message) => {
      void options.presentation.modalDialog.showConfirm({
        title: "Unable to open drawing",
        message,
        confirmLabel: "OK",
        cancelLabel: "Dismiss",
      });
    },
  };
}

function createAccountThumbnailUploader(options: {
  multiplayerApiClient: MultiplayerApiClient | null;
}): (
  summary: KidsDocumentSummary | null,
  thumbnail: Blob,
) => Promise<void> {
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
