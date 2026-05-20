import type {
  DrawingDocumentSize,
  DrawingStore,
  SmalldrawCore,
} from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import type { ShapeRendererRegistry } from "@smalldraw/renderer-canvas";
import { type IconNode, Trash2 } from "lucide";
import { mount, unmount } from "redom";
import type { KidsDocumentBackend, KidsDocumentSummary } from "../documents";
import { resolveDocumentClaimState } from "../documents";
import { createKidsDrawPerfSession } from "../perf/kidsDrawPerf";
import type { RasterPipeline } from "../render/createRasterPipeline";
import type {
  KidsToolCatalog,
  KidsToolConfig,
  KidsToolFamilyConfig,
} from "../tools/kidsTools";
import {
  createToolbarUiPersistence,
  type ToolbarUiPersistence,
} from "../ui/stores/toolbarUiPersistence";
import type { ToolbarUiStore } from "../ui/stores/toolbarUiStore";
import { createDocumentBrowserDialogView } from "../view/DocumentBrowserDialogView";
import { GlobalEventSurface } from "../view/GlobalEventSurface";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";
import { createNewDocumentDialogView } from "../view/NewDocumentDialogView";
import type { SharePayload } from "./createCollaborativeUpgradeCoordinator";
import { createCursorOverlayController } from "./createCursorOverlayController";
import { createDocumentBrowserCommands } from "./createDocumentBrowserCommands";
import { DocumentPickerController } from "./createDocumentPickerController";
import {
  createDocumentRuntimeController,
  type DocumentRuntimeController,
} from "./createDocumentRuntimeController";
import { InputSessionController } from "./createInputSessionController";
import { createKidsDrawInteractionRuntime } from "./createKidsDrawInteractionRuntime";
import { createKidsDrawRenderingRuntime } from "./createKidsDrawRenderingRuntime";
import { createLifecycleScope } from "./createLifecycleScope";
import { SnapshotService } from "./createSnapshotService";
import { ToolbarStateController } from "./createToolbarStateController";
import { logDiagnosticEvent } from "./diagnostics/diagnosticLogger";
import type {
  CollaborationStatus,
  CollaborationStatusStore,
} from "./stores/createCollaborationStatusStore";
import { createKidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";
import { createStartupReadinessStore } from "./stores/createStartupReadinessStore";
import type { UiIntentStore } from "./stores/createUiIntentStore";

type ConfirmDialogRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: IconNode;
};

export interface KidsDrawController {
  destroy(): void;
}

export interface KidsDrawSizingPolicy {
  hasExplicitSize: boolean;
  getExplicitSize: () => DrawingDocumentSize;
  resolvePageSize: () => DrawingDocumentSize;
}

function toClaimErrorMessage(
  reason:
    | "not_collaborative"
    | "already_attached"
    | "missing_access_token"
    | "wrong_access_scope",
): string {
  switch (reason) {
    case "not_collaborative":
      return "Only shared drawings can be claimed.";
    case "already_attached":
      return "This drawing is already attached to your account.";
    case "missing_access_token":
      return "This browser does not have a claim token for this drawing.";
    case "wrong_access_scope":
      return "This browser only has join access for this drawing.";
  }
}

function toUiOpenDocumentErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    /document .* is unavailable/i.test(error.message)
  ) {
    return "This drawing is no longer stored in this browser.";
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Failed to open this drawing.";
}

export function createKidsDrawController(options: {
  store: DrawingStore;
  core: SmalldrawCore;
  toolbar: KidsDrawToolbar;
  catalog: KidsToolCatalog;
  shapeRendererRegistry: ShapeRendererRegistry;
  tools: KidsToolConfig[];
  families: KidsToolFamilyConfig[];
  uiIntentStore: UiIntentStore;
  stage: KidsDrawStage;
  toolbarUiStore: ToolbarUiStore;
  pipeline: RasterPipeline;
  appElement: HTMLDivElement;
  documentBackend: KidsDocumentBackend;
  collaborationStatusStore: Pick<
    CollaborationStatusStore,
    "setCurrentDocument" | "getStatus" | "subscribe"
  >;
  backgroundColor: string;
  initialSize: DrawingDocumentSize;
  sizingPolicy: KidsDrawSizingPolicy;
  providedCore: boolean;
  confirmDestructiveAction: (dialog: ConfirmDialogRequest) => Promise<boolean>;
  savePngExport?: (input: {
    suggestedName: string;
    blob?: Blob;
    dataUrl?: string;
  }) => Promise<boolean>;
  createDocumentCopy?: () => { url: string; binary: Uint8Array };
  registerCollaborativeDocument?: (
    documentId: string,
    content: Uint8Array,
  ) => Promise<{
    joinSecret: string;
    accessToken: string;
    accessTokenScope: "owner";
  }>;
  claimCollaborativeDocument?: (accessToken: string) => Promise<void>;
  uploadDocumentThumbnail?: (
    document: KidsDocumentSummary,
    thumbnail: Blob,
  ) => Promise<void>;
  onThumbnailSaved?: (docUrl: string, thumbnail: Blob) => Promise<void> | void;
  initialCatalogDocUrl?: string;
  beforeOpenDocument?: (
    summary: KidsDocumentSummary | null,
  ) => Promise<void> | void;
  resolveJoinBaseUrl?: () => string;
  showShareDialog: (payload: SharePayload) => Promise<void>;
  onShareError?: (message: string) => void;
  onClaimError?: (message: string) => void;
  onOpenDocumentError?: (message: string) => void;
  onDocumentOpenRequested?: (
    summary: KidsDocumentSummary | null,
    docUrl: string,
  ) => void;
  onCurrentDocumentSummaryChanged?: (
    summary: KidsDocumentSummary | null,
  ) => void;
}): KidsDrawController {
  const {
    store,
    core,
    toolbar,
    catalog,
    shapeRendererRegistry,
    tools,
    families,
    uiIntentStore,
    stage,
    toolbarUiStore,
    pipeline,
    appElement,
    documentBackend,
    collaborationStatusStore,
    backgroundColor,
    initialSize,
    sizingPolicy,
    providedCore,
    confirmDestructiveAction,
    savePngExport,
    createDocumentCopy,
    registerCollaborativeDocument,
    onThumbnailSaved,
    initialCatalogDocUrl,
    beforeOpenDocument,
    resolveJoinBaseUrl,
    showShareDialog,
    onShareError,
    onClaimError,
    onOpenDocumentError,
    onDocumentOpenRequested,
  } = options;
  let size = {
    width: initialSize.width,
    height: initialSize.height,
  };
  const getSize = (): DrawingDocumentSize => ({ ...size });
  const setSize = (nextSize: DrawingDocumentSize): void => {
    size = nextSize;
  };

  const perfSession = createKidsDrawPerfSession();
  const lifecycleScope = createLifecycleScope();
  const { add } = lifecycleScope;

  const runtimeStore = createKidsDrawRuntimeStore();
  const startupReadinessStore = createStartupReadinessStore();
  const snapshotService = new SnapshotService({
    store,
    shapeRendererRegistry,
    backgroundColor,
  });
  const cursorOverlay = createCursorOverlayController({
    store,
    stage,
    cursorModeByToolId: new Map(
      tools.map((tool) => [tool.id, tool.cursorMode] as const),
    ),
    cursorPreviewIconByToolId: new Map(
      tools.flatMap((tool) =>
        tool.cursorPreviewIcon
          ? ([[tool.id, tool.cursorPreviewIcon]] as const)
          : [],
      ),
    ),
    viewportMetricsStore: runtimeStore.$viewportMetrics,
  });
  let toolbarStateController: ToolbarStateController;
  let toolbarUiPersistence: ToolbarUiPersistence;
  const syncToolbarUi = (): void => {
    toolbarStateController.syncToolbarUi();
  };
  const globalEventSurface = new GlobalEventSurface();

  const debugLifecycle = (...args: unknown[]): void => {
    if (
      !(globalThis as { __kidsDrawDebugLifecycle?: boolean })
        .__kidsDrawDebugLifecycle
    ) {
      return;
    }
    console.debug("[kids-draw:lifecycle]", ...args);
  };

  const documentBrowserDialog = createDocumentBrowserDialogView({
    onClose: () => {
      documentPickerController.close();
    },
    onOpenCreateDialog: () => {
      documentPickerController.openCreateDialog();
    },
    onOpenDocument: (docUrl) => {
      void openDocumentFromBrowser(docUrl).catch((error) => {
        const message = toUiOpenDocumentErrorMessage(error);
        console.error("[kids-draw:documents] unhandled open failure", {
          docUrl,
          message,
          error,
        });
        onOpenDocumentError?.(message);
      });
    },
    onClaimDocument: (docUrl) => {
      void claimDocumentFromBrowser(docUrl);
    },
    onDeleteDocument: (docUrl) => {
      void deleteDocumentFromBrowser(docUrl);
    },
  });
  const newDocumentDialog = createNewDocumentDialogView({
    onClose: () => {
      documentPickerController.closeCreateDialog();
    },
    onCreate: (request) => {
      void createNewDocumentFromBrowser(request);
    },
  });
  mount(appElement, documentBrowserDialog.el);
  mount(appElement, newDocumentDialog.el);
  let documentRuntimeController: DocumentRuntimeController | null = null;
  const documentPickerController = new DocumentPickerController({
    browserDialog: documentBrowserDialog,
    newDocumentDialog,
    documentBackend,
    getCurrentDocUrl: () =>
      documentRuntimeController?.getCurrentCatalogDocUrl() ??
      core.getCurrentDocUrl(),
  });
  toolbarStateController = new ToolbarStateController({
    store,
    toolbarUiStore,
    catalog,
    families,
    getCurrentDocUrl: () => core.getCurrentDocUrl(),
    cursorOverlaySync: () => cursorOverlay.sync(),
  });
  toolbarUiPersistence = createToolbarUiPersistence({
    toolbarUiStore,
    getCurrentDocUrl: () => core.getCurrentDocUrl(),
  });
  let scheduleThumbnailSaveForInput: (delayMs: number) => void = () => {};
  const inputSessionController = new InputSessionController({
    store,
    cursorOverlay,
    overlayElement: stage.overlay,
    initialLastPointerPoint: new Vec2(0, 0),
    toPoint: (event) => cursorOverlay.toPoint(event),
    onScheduleThumbnailSave: (delayMs) => {
      scheduleThumbnailSaveForInput(delayMs);
    },
    perfSession: {
      begin: () => perfSession.begin(),
      end: (frameCount) => perfSession.end(frameCount),
      onPointerMoveSamples: (sampleCount, usedCoalesced) =>
        perfSession.onPointerMoveSamples(sampleCount, usedCoalesced),
    },
  });
  const {
    renderLoopController,
    layoutController,
    resolveImplicitDocumentSizeFromViewport,
    applyCanvasSize,
    applyLayoutAndPixelRatio,
    scheduleResponsiveLayout,
  } = createKidsDrawRenderingRuntime({
    stage,
    toolbar,
    pipeline,
    backgroundColor,
    runtimeStore,
    resolvePageSize: sizingPolicy.resolvePageSize,
    getSize,
    setSize,
    inputSessionController,
    syncToolbarUi,
    perfSession,
  });

  documentRuntimeController = createDocumentRuntimeController({
    store,
    core,
    documentBackend,
    snapshotService,
    runtimeStore,
    onCurrentDocumentSummaryChanged: (summary) => {
      collaborationStatusStore.setCurrentDocument(summary);
      options.onCurrentDocumentSummaryChanged?.(summary);
    },
    startupReadinessStore,
    toolbarStateController,
    renderLoopController,
    pipeline,
    syncToolbarUi,
    applyCanvasSize,
    getDocumentSizeFromViewport: () =>
      resolveImplicitDocumentSizeFromViewport(),
    hasExplicitSize: sizingPolicy.hasExplicitSize,
    getExplicitSize: sizingPolicy.getExplicitSize,
    createDocumentCopy,
    registerCollaborativeDocument,
    onThumbnailSaved,
    initialCatalogDocUrl,
    beforeOpenDocument,
    resolveJoinBaseUrl,
  });
  const runtimeDocumentController = documentRuntimeController;
  scheduleThumbnailSaveForInput = (delayMs) => {
    runtimeDocumentController.scheduleThumbnailSave(delayMs);
  };

  const documentBrowserCommands = createDocumentBrowserCommands({
    documentPickerController,
    getCurrentDocUrl: () => runtimeDocumentController.getCurrentCatalogDocUrl(),
    switchToDocument: (docUrl) =>
      runtimeDocumentController.switchToDocument(docUrl),
    createNewDocument: (request) =>
      runtimeDocumentController.createNewDocument(request),
    flushThumbnailSave: () => runtimeDocumentController.flushThumbnailSave(),
    listDocuments: () => documentBackend.listDocuments(),
    claimDocument: async (document) => {
      if (!options.claimCollaborativeDocument) {
        throw new Error("Account claim is not configured");
      }
      const claimState = resolveDocumentClaimState(document);
      console.info("[kids-draw:documents] claim state evaluated", {
        docUrl: document.docUrl,
        collaborative: document.collaborative ?? false,
        collabDocUrl: document.collabDocUrl ?? null,
        accessToken: document.accessToken ? "<present>" : null,
        accessTokenScope: document.accessTokenScope ?? null,
        claimState,
      });
      if (!claimState.claimable) {
        throw new Error(toClaimErrorMessage(claimState.reason));
      }
      await options.claimCollaborativeDocument(claimState.accessToken);
      const attachedDocument = await documentBackend.createDocument({
        docUrl: document.docUrl,
        accountAttached: true,
      });
      const thumbnail = await documentBackend.getThumbnail(document.docUrl);
      if (thumbnail && options.uploadDocumentThumbnail) {
        await options.uploadDocumentThumbnail(attachedDocument, thumbnail);
      }
    },
    isClaimableDocument: (document) =>
      resolveDocumentClaimState(document).claimable,
    describeClaimability: (document) => ({
      claimState: resolveDocumentClaimState(document),
    }),
    deleteDocument: (docUrl) => documentBackend.deleteDocument(docUrl),
    confirmDelete: () =>
      confirmDestructiveAction({
        title: "Delete drawing?",
        message: "This drawing will be removed.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        tone: "danger",
        icon: Trash2,
      }),
    onClaimError,
    onOpenDocumentError,
    onDocumentOpenRequested,
    isDestroyed: () => runtimeStore.isDestroyed(),
  });
  const {
    closeDocumentPicker,
    openDocumentPicker,
    createNewDocumentFromBrowser,
    openDocumentFromBrowser,
    claimDocumentFromBrowser,
    deleteDocumentFromBrowser,
  } = documentBrowserCommands;
  const unbindGlobalIntents = globalEventSurface.bindIntents({
    windowTarget: window,
    documentTarget: document,
    isDocumentPickerOpen: () => documentPickerController.isOpen(),
    uiIntentStore,
  });
  add(unbindGlobalIntents);
  const { commandController } = createKidsDrawInteractionRuntime({
    store,
    toolbarUiStore,
    toolbarStateController,
    inputSessionController,
    cursorOverlay,
    uiIntentStore,
    lifecycle: { add },
    documentBrowserCommands: {
      closeDocumentPicker,
      openDocumentPicker,
      shareCurrentDocument: async () => {
        console.info("[kids-draw:multiplayer] ui share bridge start");
        const payload = await runtimeDocumentController.shareCurrentDocument();
        console.info("[kids-draw:multiplayer] ui share bridge payload ready", {
          catalogDocUrl: payload.catalogDocUrl,
          collabDocUrl: payload.collabDocUrl,
          upgraded: payload.upgraded,
        });
        await showShareDialog(payload);
        console.info("[kids-draw:multiplayer] ui share dialog shown");
      },
    },
    snapshotService,
    getSize,
    confirmDestructiveAction,
    savePngExport,
    runtimeStore,
    documentPickerController,
    scheduleResponsiveLayout,
    debugLifecycle,
    onShareError,
  });

  const applyCollaborationStatus = (status: CollaborationStatus): void => {
    toolbar.setCollaborationStatus(status);
  };
  applyCollaborationStatus(collaborationStatusStore.getStatus());
  const unbindCollaborationStatus = collaborationStatusStore.subscribe(
    applyCollaborationStatus,
  );
  add(unbindCollaborationStatus);

  store.setOnRenderNeeded(() => {
    perfSession.onModelInvalidation();
    syncToolbarUi();
    renderLoopController.requestRenderFromModel();
  });
  store.setOnAction((event) => {
    const affectedShapeIds = event.action.affectedShapeIds();
    logDiagnosticEvent("store_action", {
      actionType: event.type,
      actionName: event.action.constructor?.name ?? "unknown_action",
      affectedShapeCount: affectedShapeIds.length,
      affectedShapeIds: affectedShapeIds.slice(0, 8),
      documentShapeCount: Object.keys(event.doc.shapes).length,
    });
  });

  toolbarUiPersistence.start();
  const unbindStartupReadiness = startupReadinessStore.subscribe((state) => {
    stage.setInteractionEnabled(state.interactionEnabled);
    stage.setStartupStatus({
      visible: !state.interactionEnabled,
      phase: state.phase,
      assetsLoaded: state.assetsLoaded,
      assetsTotal: state.assetsTotal,
      assetsFailed: state.assetsFailed,
      blockingReason: state.lastBlockingReason,
    });
  });
  add(unbindStartupReadiness);
  runtimeDocumentController.start();
  renderLoopController.updateRenderIdentity();
  applyLayoutAndPixelRatio();
  renderLoopController.scheduleResizeBake();
  renderLoopController.requestRenderFromModel();

  return {
    destroy() {
      runtimeStore.setDestroyed(true);
      commandController.destroy();
      debugLifecycle("destroy");

      store.setOnRenderNeeded(undefined);
      store.setOnAction(undefined);
      toolbarUiPersistence.stop();
      toolbarUiPersistence.flush();
      runtimeDocumentController.dispose();
      documentPickerController.dispose();
      layoutController.dispose();
      renderLoopController.dispose();
      cursorOverlay.dispose();
      stage.destroy();

      lifecycleScope.disposeAll();

      pipeline.dispose();
      unmount(appElement, documentBrowserDialog.el);
      unmount(appElement, newDocumentDialog.el);
      if (!providedCore) {
        core.destroy();
      }
    },
  };
}
