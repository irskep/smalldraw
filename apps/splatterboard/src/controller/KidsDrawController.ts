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
import { createKidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";
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
  backgroundColor: string;
  initialSize: DrawingDocumentSize;
  sizingPolicy: KidsDrawSizingPolicy;
  providedCore: boolean;
  confirmDestructiveAction: (dialog: ConfirmDialogRequest) => Promise<boolean>;
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
    backgroundColor,
    initialSize,
    sizingPolicy,
    providedCore,
    confirmDestructiveAction,
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
    onDeleteDocument: (docUrl) => {
      void deleteDocumentFromBrowser(docUrl);
    },
  });
  mount(appElement, documentPickerOverlay.el);
  const documentPickerController = new DocumentPickerController({
    pickerOverlay: documentPickerOverlay,
    documentBackend,
    getCurrentDocUrl: () => core.getCurrentDocUrl(),
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

  const documentRuntimeController: DocumentRuntimeController =
    createDocumentRuntimeController({
      store,
      core,
      documentBackend,
      snapshotService,
      runtimeStore,
      toolbarStateController,
      renderLoopController,
      pipeline,
      syncToolbarUi,
      applyCanvasSize,
      getDocumentSizeFromViewport: () =>
        resolveImplicitDocumentSizeFromViewport(),
      hasExplicitSize: sizingPolicy.hasExplicitSize,
      getExplicitSize: sizingPolicy.getExplicitSize,
    });
  scheduleThumbnailSaveForInput = (delayMs) => {
    documentRuntimeController.scheduleThumbnailSave(delayMs);
  };

  const documentBrowserCommands = createDocumentBrowserCommands({
    documentPickerController,
    getCurrentDocUrl: () => core.getCurrentDocUrl(),
    switchToDocument: (docUrl) =>
      documentRuntimeController.switchToDocument(docUrl),
    createNewDocument: (request) =>
      documentRuntimeController.createNewDocument(request),
    flushThumbnailSave: () => documentRuntimeController.flushThumbnailSave(),
    listDocuments: () => documentBackend.listDocuments(),
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
    isDestroyed: () => runtimeStore.isDestroyed(),
  });
  const {
    closeDocumentPicker,
    openDocumentPicker,
    createNewDocumentFromBrowser,
    openDocumentFromBrowser,
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
    },
    snapshotService,
    getSize,
    confirmDestructiveAction,
    runtimeStore,
    documentPickerController,
    scheduleResponsiveLayout,
    positionMobilePortraitActionsPopover,
    applyToolbarLayoutProfile,
    debugLifecycle,
  });

  store.setOnRenderNeeded(() => {
    perfSession.onModelInvalidation();
    syncToolbarUi();
    renderLoopController.requestRenderFromModel();
  });

  toolbarUiPersistence.start();
  documentRuntimeController.start();
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
      toolbarUiPersistence.stop();
      toolbarUiPersistence.flush();
      documentRuntimeController.dispose();
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
