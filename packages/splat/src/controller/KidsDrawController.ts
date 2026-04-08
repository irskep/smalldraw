import type {
  DrawingDocumentSize,
  DrawingStore,
  SmalldrawCore,
} from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import type { ShapeRendererRegistry } from "@smalldraw/renderer-canvas";
import { type IconNode, Trash2 } from "lucide";
import { mount } from "redom";
import type { KidsDocumentBackend } from "../documents";
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
import { createDocumentBrowserOverlay } from "../view/DocumentBrowserOverlay";
import { GlobalEventSurface } from "../view/GlobalEventSurface";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import type { KidsDrawToolbarView } from "../view/KidsDrawToolbar";
import { MobilePortraitActionsView } from "../view/MobilePortraitActionsView";
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

export function createKidsDrawController(options: {
  store: DrawingStore;
  core: SmalldrawCore;
  toolbar: KidsDrawToolbarView;
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
  initialCatalogDocUrl?: string;
  resolveJoinBaseUrl?: () => string;
  showShareDialog: (payload: SharePayload) => Promise<void>;
  onShareError?: (message: string) => void;
  onClaimError?: (message: string) => void;
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
    initialCatalogDocUrl,
    resolveJoinBaseUrl,
    showShareDialog,
    onShareError,
    onClaimError,
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
  const mobilePortraitActionsUi = new MobilePortraitActionsView();
  const globalEventSurface = new GlobalEventSurface();
  const unbindMobilePortraitActionsUiState =
    mobilePortraitActionsUi.bindUiState(toolbarUiStore.$state);
  add(unbindMobilePortraitActionsUiState);

  const debugLifecycle = (...args: unknown[]): void => {
    if (
      !(globalThis as { __kidsDrawDebugLifecycle?: boolean })
        .__kidsDrawDebugLifecycle
    ) {
      return;
    }
    console.debug("[kids-draw:lifecycle]", ...args);
  };

  const documentPickerOverlay = createDocumentBrowserOverlay({
    onClose: () => {
      documentPickerController.close();
    },
    onNewDocument: (request) => {
      void createNewDocumentFromBrowser(request);
    },
    onOpenDocument: (docUrl) => {
      void openDocumentFromBrowser(docUrl);
    },
    onClaimDocument: (docUrl) => {
      void claimDocumentFromBrowser(docUrl);
    },
    onDeleteDocument: (docUrl) => {
      void deleteDocumentFromBrowser(docUrl);
    },
  });
  mount(appElement, documentPickerOverlay.el);
  let documentRuntimeController: DocumentRuntimeController | null = null;
  const documentPickerController = new DocumentPickerController({
    pickerOverlay: documentPickerOverlay,
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
    positionMobilePortraitActionsPopover,
    applyToolbarLayoutProfile,
    resolveImplicitDocumentSizeFromViewport,
    applyCanvasSize,
    applyLayoutAndPixelRatio,
    scheduleResponsiveLayout,
  } = createKidsDrawRenderingRuntime({
    stage,
    toolbar,
    mobilePortraitActionsView: mobilePortraitActionsUi,
    toolbarUiStore,
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
    initialCatalogDocUrl,
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
      await documentBackend.createDocument({
        docUrl: document.docUrl,
        accountAttached: true,
      });
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
  const unbindMobilePortraitActionsIntents =
    mobilePortraitActionsUi.bindIntents({
      uiIntentStore,
      layoutController,
    });
  add(unbindMobilePortraitActionsIntents);
  const unbindGlobalIntents = globalEventSurface.bindIntents({
    windowTarget: window,
    documentTarget: document,
    getCurrentLayoutProfile: () => layoutController.getCurrentLayoutProfile(),
    isMobileActionsOpen: () => toolbarUiStore.get().mobileActionsOpen,
    isInMobilePortraitChrome: (target) =>
      mobilePortraitActionsUi.containsTarget(target),
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
    positionMobilePortraitActionsPopover,
    applyToolbarLayoutProfile,
    debugLifecycle,
    onShareError,
  });

  const applyCollaborationStatus = (status: CollaborationStatus): void => {
    toolbar.setCollaborationStatus({
      visible: status.visible,
      label: status.visible ? status.label : undefined,
    });
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

      toolbar.destroy();
      pipeline.dispose();
      documentPickerOverlay.el.remove();
      if (!providedCore) {
        core.destroy();
      }
    },
  };
}
