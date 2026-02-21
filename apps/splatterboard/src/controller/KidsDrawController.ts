import {
  ClearCanvas,
  type DrawingDocumentPresentation,
  type DrawingDocumentSize,
  type DrawingStore,
  getTopZIndex,
  type SmalldrawCore,
} from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import { type ShapeRendererRegistry } from "@smalldraw/renderer-canvas";
import {
  Download,
  FilePlus,
  FolderOpen,
  type IconNode,
  MoreHorizontal,
  Palette,
  Redo2,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide";
import { mount, setChildren } from "redom";
import { getColoringPageById } from "../coloring/catalog";
import type {
  KidsDocumentBackend,
  KidsDocumentSummary,
} from "../documents";
import {
  normalizePixelRatio,
} from "../layout/responsiveLayout";
import { createKidsDrawPerfSession } from "../perf/kidsDrawPerf";
import type { RasterPipeline } from "../render/createRasterPipeline";
import {
  type KidsToolCatalog,
  type KidsToolConfig,
  type KidsToolFamilyConfig,
} from "../tools/kidsTools";
import {
  getLoadedRasterImage,
  registerRasterImage,
  warmRasterImage,
} from "../shapes/rasterImageCache";
import {
  type ToolbarUiStore,
} from "../ui/stores/toolbarUiStore";
import {
  createToolbarUiPersistence,
  type ToolbarUiPersistence,
} from "../ui/stores/toolbarUiPersistence";
import {
  createDocumentBrowserOverlay,
  type NewDocumentRequest,
} from "../view/DocumentBrowserOverlay";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import { type KidsDrawToolbar } from "../view/KidsDrawToolbar";
import { createSquareIconButton } from "../view/SquareIconButton";
import {
  DocumentSessionController,
  type DocumentSessionPresentation,
} from "./createDocumentSessionController";
import { DocumentPickerController } from "./createDocumentPickerController";
import { createCursorOverlayController } from "./createCursorOverlayController";
import { InputSessionController } from "./createInputSessionController";
import { LayoutController } from "./createLayoutController";
import { RenderLoopController } from "./createRenderLoopController";
import { SnapshotService } from "./createSnapshotService";
import { createKidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";
import { ToolbarStateController } from "./createToolbarStateController";

const RESIZE_BAKE_DEBOUNCE_MS = 120;
const THUMBNAIL_SAVE_DEBOUNCE_MS = 1000;
const DEFAULT_OPAQUE_STROKE_COLOR = "#000000";
const DEFAULT_OPAQUE_FILL_COLOR = "#ffffff";
const UI_STATE_PERSIST_DEBOUNCE_MS = 150;
const MOBILE_ACTIONS_MENU_GAP_PX = 8;
const MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX = 8;
const NORMAL_DEFAULT_TOOL_ID = "brush.marker";
const COLORING_DEFAULT_TOOL_ID = "brush.marker";
const NORMAL_DEFAULT_STROKE_WIDTH = 8;
const COLORING_DEFAULT_STROKE_WIDTH = 24;

type ConfirmDialogRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: IconNode;
};

type SaveFilePickerLike = (options: {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

export interface KidsDrawController {
  destroy(): void;
}

type ActiveDocumentPresentation = DocumentSessionPresentation;

export function createKidsDrawController(options: {
  store: DrawingStore;
  core: SmalldrawCore;
  toolbar: KidsDrawToolbar;
  catalog: KidsToolCatalog;
  shapeRendererRegistry: ShapeRendererRegistry;
  tools: KidsToolConfig[];
  families: KidsToolFamilyConfig[];
  stage: KidsDrawStage;
  toolbarUiStore: ToolbarUiStore;
  pipeline: RasterPipeline;
  appElement: HTMLDivElement;
  documentBackend: KidsDocumentBackend;
  backgroundColor: string;
  hasExplicitSize: boolean;
  providedCore: boolean;
  resolvePageSize: () => { width: number; height: number };
  getExplicitSize: () => DrawingDocumentSize;
  getSize: () => { width: number; height: number };
  setSize: (size: { width: number; height: number }) => void;
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
    stage,
    toolbarUiStore,
    pipeline,
    appElement,
    documentBackend,
    backgroundColor,
    hasExplicitSize,
    providedCore,
    resolvePageSize,
    getExplicitSize,
    getSize,
    setSize,
    confirmDestructiveAction,
  } = options;

  const perfSession = createKidsDrawPerfSession();
  const disposers: Array<() => void> = [];

  const runtimeStore = createKidsDrawRuntimeStore();
  let newDrawingRequestId = 0;
  let clearCounter = 0;
  let coloringOverlayLoadRequestId = 0;
  let documentSessionController: DocumentSessionController;
  const snapshotService = new SnapshotService({
    store,
    shapeRendererRegistry,
    backgroundColor,
    getReferenceImageSrc: (composite) => runtimeStore.getReferenceImageSrc(composite),
  });
  const cursorOverlay = createCursorOverlayController({
    store,
    stage,
    getSize,
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
  });
  let toolbarStateController: ToolbarStateController;
  let toolbarUiPersistence: ToolbarUiPersistence;
  const syncToolbarUi = (): void => {
    toolbarStateController.syncToolbarUi();
  };
  const inputSessionController = new InputSessionController({
    store,
    cursorOverlay,
    overlayElement: stage.overlay,
    initialLastPointerPoint: new Vec2(0, 0),
    toPoint: (event) => cursorOverlay.toPoint(event),
    onScheduleThumbnailSave: (delayMs) => scheduleThumbnailSave(delayMs),
    perfSession: {
      begin: () => perfSession.begin(),
      end: (frameCount) => perfSession.end(frameCount),
      onPointerMoveSamples: (sampleCount, usedCoalesced) =>
        perfSession.onPointerMoveSamples(sampleCount, usedCoalesced),
    },
  });
  const mobilePortraitBottomStrip = document.createElement("div");
  mobilePortraitBottomStrip.className = "kids-draw-mobile-portrait-bottom";
  const mobilePortraitTopStrip = document.createElement("div");
  mobilePortraitTopStrip.className = "kids-draw-mobile-portrait-top";
  const mobilePortraitTopControls = document.createElement("div");
  mobilePortraitTopControls.className = "kids-draw-mobile-top-controls";
  const mobilePortraitColorsButton = createSquareIconButton({
    className: "kids-draw-mobile-top-toggle kids-draw-tool-button",
    label: "Color",
    icon: Palette,
    attributes: {
      title: "Show colors",
      "aria-label": "Show colors",
      layout: "row",
    },
  });
  const mobilePortraitStrokesButton = createSquareIconButton({
    className: "kids-draw-mobile-top-toggle kids-draw-tool-button",
    label: "Size",
    icon: SlidersHorizontal,
    attributes: {
      title: "Show stroke widths",
      "aria-label": "Show stroke widths",
      layout: "row",
    },
  });
  const mobilePortraitActionsTrigger = createSquareIconButton({
    className: "kids-draw-mobile-actions-trigger",
    label: "Actions",
    icon: MoreHorizontal,
    attributes: {
      title: "Actions",
      "aria-label": "Actions",
      "aria-haspopup": "menu",
      "aria-controls": "kids-draw-mobile-actions-menu",
      "aria-expanded": "false",
    },
  });
  const mobilePortraitActionsPopover = document.createElement("div");
  mobilePortraitActionsPopover.className = "kids-draw-mobile-actions-popover";
  mobilePortraitActionsPopover.dataset.open = "false";
  mobilePortraitActionsPopover.setAttribute("aria-hidden", "true");
  mobilePortraitActionsPopover.hidden = true;
  const mobilePortraitActionsMenu = document.createElement("div");
  mobilePortraitActionsMenu.id = "kids-draw-mobile-actions-menu";
  mobilePortraitActionsMenu.className = "kids-draw-mobile-actions-menu";
  mobilePortraitActionsMenu.setAttribute("role", "menu");
  mobilePortraitActionsMenu.setAttribute("aria-label", "Actions");
  const SVG_NS = "http://www.w3.org/2000/svg";
  const createMenuIcon = (iconNode: IconNode): SVGSVGElement => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    for (const [tag, attrs] of iconNode) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attrs)) {
        if (value !== undefined) {
          node.setAttribute(name, `${value}`);
        }
      }
      svg.appendChild(node);
    }
    return svg;
  };
  const createMobilePortraitActionItem = (
    actionId: string,
    label: string,
    icon: IconNode,
    options?: {
      danger?: boolean;
    },
  ): HTMLButtonElement => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "kids-draw-mobile-actions-item kd-button-unstyled";
    item.dataset.mobileAction = actionId;
    item.setAttribute("role", "menuitem");
    const iconElement = document.createElement("span");
    iconElement.className = "kids-draw-mobile-actions-item-icon";
    iconElement.appendChild(createMenuIcon(icon));
    const labelElement = document.createElement("span");
    labelElement.className = "kids-draw-mobile-actions-item-label";
    labelElement.textContent = label;
    setChildren(item, [iconElement, labelElement]);
    if (options?.danger) {
      item.classList.add("is-danger");
    }
    return item;
  };
  const mobilePortraitUndoMenuItem = createMobilePortraitActionItem(
    "undo",
    "Undo",
    Undo2,
  );
  const mobilePortraitRedoMenuItem = createMobilePortraitActionItem(
    "redo",
    "Redo",
    Redo2,
  );
  const mobilePortraitUndoRedoRow = document.createElement("div");
  mobilePortraitUndoRedoRow.className = "kids-draw-mobile-actions-row";
  mobilePortraitUndoRedoRow.setAttribute("role", "group");
  mobilePortraitUndoRedoRow.setAttribute("aria-label", "History");
  setChildren(mobilePortraitUndoRedoRow, [
    mobilePortraitUndoMenuItem,
    mobilePortraitRedoMenuItem,
  ]);
  const mobilePortraitMenuDivider = document.createElement("div");
  mobilePortraitMenuDivider.className = "kids-draw-mobile-actions-divider";
  mobilePortraitMenuDivider.setAttribute("role", "separator");
  const mobilePortraitSecondaryDivider = document.createElement("div");
  mobilePortraitSecondaryDivider.className = "kids-draw-mobile-actions-divider";
  mobilePortraitSecondaryDivider.setAttribute("role", "separator");
  const mobilePortraitNewMenuItem = createMobilePortraitActionItem(
    "new-drawing",
    "New Drawing",
    FilePlus,
  );
  const mobilePortraitBrowseMenuItem = createMobilePortraitActionItem(
    "browse",
    "Browse Drawings",
    FolderOpen,
  );
  const mobilePortraitExportMenuItem = createMobilePortraitActionItem(
    "export",
    "Export PNG",
    Download,
  );
  const mobilePortraitClearMenuItem = createMobilePortraitActionItem(
    "clear",
    "Clear Canvas",
    Trash2,
    { danger: true },
  );
  setChildren(mobilePortraitActionsMenu, [
    mobilePortraitUndoRedoRow,
    mobilePortraitMenuDivider,
    mobilePortraitNewMenuItem,
    mobilePortraitBrowseMenuItem,
    mobilePortraitExportMenuItem,
    mobilePortraitSecondaryDivider,
    mobilePortraitClearMenuItem,
  ]);
  mobilePortraitColorsButton.setSelected(true);
  mobilePortraitStrokesButton.setSelected(false);

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
    toolbar,
    catalog,
    families,
    getCurrentDocUrl: () => core.getCurrentDocUrl(),
    cursorOverlaySync: () => cursorOverlay.sync(),
    mobilePortraitUndoMenuItem,
    mobilePortraitRedoMenuItem,
    mobilePortraitNewMenuItem,
    opaqueStrokeColor: DEFAULT_OPAQUE_STROKE_COLOR,
    opaqueFillColor: DEFAULT_OPAQUE_FILL_COLOR,
    normalDefaultToolId: NORMAL_DEFAULT_TOOL_ID,
    coloringDefaultToolId: COLORING_DEFAULT_TOOL_ID,
    normalDefaultStrokeWidth: NORMAL_DEFAULT_STROKE_WIDTH,
    coloringDefaultStrokeWidth: COLORING_DEFAULT_STROKE_WIDTH,
  });
  toolbarUiPersistence = createToolbarUiPersistence({
    toolbarUiStore,
    getCurrentDocUrl: () => core.getCurrentDocUrl(),
    debounceMs: UI_STATE_PERSIST_DEBOUNCE_MS,
  });
  const renderLoopController = new RenderLoopController(
    {
      pipeline,
      backgroundColor,
      resizeBakeDebounceMs: RESIZE_BAKE_DEBOUNCE_MS,
      getSize,
      getPresentationIdentity: () =>
        runtimeStore.getPresentationIdentity(),
      onRenderPass: () => {
        const startMs = perfSession.recordRenderPassStart();
        inputSessionController.onRenderPass();
        syncToolbarUi();
        pipeline.render();
        pipeline.updateDirtyRectOverlay();
        perfSession.recordRenderPassEnd(startMs);
      },
      perfSession: {
        onRafFrameExecuted: () => perfSession.onRafFrameExecuted(),
      },
    },
    normalizePixelRatio(
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    ),
  );
  const layoutController = new LayoutController({
    stage,
    toolbar,
    resolvePageSize,
    getSize,
    setSize: (size) => setSize(size),
    getDestroyed: () => runtimeStore.isDestroyed(),
    onUpdateViewport: (width, height) => pipeline.updateViewport(width, height),
    onUpdateRenderIdentity: () => renderLoopController.updateRenderIdentity(),
    onRequestRenderFromModel: () => renderLoopController.requestRenderFromModel(),
    onScheduleResizeBake: () => renderLoopController.scheduleResizeBake(),
    setTilePixelRatio: (pixelRatio) => renderLoopController.setTilePixelRatio(pixelRatio),
    onRefreshCursorMetrics: () => cursorOverlay.refreshMetrics(),
    mobilePortraitBottomStrip,
    mobilePortraitTopStrip,
    mobilePortraitTopControls,
    mobilePortraitActionsPopover,
    mobilePortraitActionsMenu,
    mobilePortraitActionsTrigger,
    mobilePortraitColorsButton,
    mobilePortraitStrokesButton,
    mobileActionsMenuGapPx: MOBILE_ACTIONS_MENU_GAP_PX,
    mobileActionsMenuViewportPaddingPx: MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX,
  });

  function listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: (event: WindowEventMap[K]) => void,
  ): void;
  function listen<K extends keyof GlobalEventHandlersEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: GlobalEventHandlersEventMap[K]) => void,
  ): void;
  function listen<K extends keyof VisualViewportEventMap>(
    target: VisualViewport,
    type: K,
    handler: (event: VisualViewportEventMap[K]) => void,
  ): void;
  function listen(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
  ): void {
    const listener: EventListener = (event) => handler(event);
    target.addEventListener(type, listener);
    disposers.push(() => target.removeEventListener(type, listener));
  }

  const resolveDocumentPresentation = (
    documentPresentation: DrawingDocumentPresentation | undefined,
  ): ActiveDocumentPresentation =>
    documentSessionController.resolveDocumentPresentation(documentPresentation);

  const getReferenceOverlaySrc = (
    presentation: ActiveDocumentPresentation,
  ): string | null => documentSessionController.getReferenceOverlaySrc(presentation);

  const toDocumentMetadataFromPresentation = (
    presentation: ActiveDocumentPresentation,
  ): Pick<
    KidsDocumentSummary,
    "mode" | "coloringPageId" | "referenceImageSrc" | "referenceComposite"
  > => documentSessionController.toDocumentMetadataFromPresentation(presentation);

  const queueColoringOverlayRebakeWhenLoaded = (overlaySrc: string | null): void => {
    coloringOverlayLoadRequestId += 1;
    if (!overlaySrc || typeof Image !== "function") {
      return;
    }
    const requestId = coloringOverlayLoadRequestId;
    if (getLoadedRasterImage(overlaySrc)) {
      return;
    }
    const loader = new Image();
    loader.decoding = "async";
    loader.onload = () => {
      if (runtimeStore.isDestroyed() || requestId !== coloringOverlayLoadRequestId) {
        return;
      }
      registerRasterImage(overlaySrc, loader);
      renderLoopController.requestRenderFromModel();
      scheduleThumbnailSave(0);
    };
    loader.src = overlaySrc;
  };

  const applyDocumentPresentation = (
    presentation: ActiveDocumentPresentation,
  ): void => {
    runtimeStore.setPresentation(presentation);
    const overlaySrc = getReferenceOverlaySrc(presentation);
    pipeline.setReferenceOverlaySource(overlaySrc);
    renderLoopController.updateRenderIdentity();
    if (overlaySrc) {
      warmRasterImage(overlaySrc);
    }
    queueColoringOverlayRebakeWhenLoaded(overlaySrc);
  };

  const applyToolbarStateForCurrentDocument = (
    presentation: ActiveDocumentPresentation,
    options?: {
      forceDefaults?: boolean;
    },
  ): void => {
    toolbarStateController.applyToolbarStateForCurrentDocument(
      presentation,
      options,
    );
  };

  const positionMobilePortraitActionsPopover = (): void => {
    layoutController.positionMobilePortraitActionsPopover();
  };

  const setMobilePortraitTopPanel = (panel: "colors" | "strokes"): void => {
    layoutController.setMobilePortraitTopPanel(panel);
  };

  const applyToolbarLayoutProfile = (): void => {
    layoutController.applyToolbarLayoutProfile(
      layoutController.getCurrentLayoutProfile(),
    );
  };

  const closeMobilePortraitActions = (): void => {
    layoutController.closeMobilePortraitActions();
  };

  const toggleMobilePortraitActions = (): void => {
    layoutController.toggleMobilePortraitActions();
  };

  const resolveImplicitDocumentSizeFromViewport = (): {
    width: number;
    height: number;
  } => layoutController.resolveImplicitDocumentSizeFromViewport();

  const applyCanvasSize = (nextWidth: number, nextHeight: number): void => {
    layoutController.applyCanvasSize(nextWidth, nextHeight);
  };

  const applyLayoutAndPixelRatio = (): void => {
    layoutController.applyLayoutAndPixelRatio();
  };

  const scheduleResponsiveLayout = (): void => {
    layoutController.scheduleResponsiveLayout();
  };

  const closeDocumentPicker = (): void => {
    documentPickerController.close();
  };

  const reloadDocumentPicker = async (): Promise<void> => {
    await documentPickerController.reload();
  };

  const openDocumentPicker = async (): Promise<void> => {
    await documentPickerController.open();
  };

  const getDocumentSizeForCreateRequest = (
    request: NewDocumentRequest,
  ): DrawingDocumentSize => {
    if (request.mode === "coloring") {
      const page = getColoringPageById(request.coloringPageId);
      if (page) {
        return page.size;
      }
    }
    return hasExplicitSize ? getExplicitSize() : resolveImplicitDocumentSizeFromViewport();
  };

  documentSessionController = new DocumentSessionController({
    store,
    core,
    documentBackend,
    thumbnailSaveDebounceMs: THUMBNAIL_SAVE_DEBOUNCE_MS,
    createThumbnailBlob: () => snapshotService.createThumbnailBlob(),
    getDocumentSizeForCreateRequest,
  });
  const unbindDocumentSessionIntents =
    documentSessionController.state.subscribeDrainedIntents((intents) => {
      for (const intent of intents) {
        if (intent.type === "apply_canvas_size") {
          applyCanvasSize(intent.width, intent.height);
          continue;
        }
        if (intent.type === "apply_presentation") {
          applyDocumentPresentation(intent.presentation);
          continue;
        }
        if (intent.type === "apply_toolbar_state") {
          applyToolbarStateForCurrentDocument(intent.presentation, {
            forceDefaults: intent.forceDefaults,
          });
          continue;
        }
        if (intent.type === "adapter_applied") {
          syncToolbarUi();
          continue;
        }
        if (intent.type === "switch_or_create_completed") {
          pipeline.scheduleBakeForClear();
          pipeline.bakePendingTiles();
          renderLoopController.requestRenderFromModel();
        }
      }
    });
  disposers.push(unbindDocumentSessionIntents);

  const switchToDocument = async (docUrl: string): Promise<void> => {
    await documentSessionController.switchToDocument(docUrl);
  };

  const createNewDocument = async (
    request: NewDocumentRequest,
  ): Promise<void> => {
    await documentSessionController.createNewDocument(request);
  };

  const createNewDocumentFromBrowser = async (
    request: NewDocumentRequest,
  ): Promise<void> => {
    if (
      !documentPickerController.isOpen() &&
      !documentPickerController.isCreateDialogOpen()
    ) {
      return;
    }
    documentPickerController.setBusyDocument("__new__");
    try {
      await createNewDocument(request);
      closeDocumentPicker();
      documentPickerController.closeCreateDialog();
    } finally {
      documentPickerController.setBusyDocument(null);
    }
  };

  const openDocumentFromBrowser = async (docUrl: string): Promise<void> => {
    if (!documentPickerController.isOpen()) {
      return;
    }
    if (docUrl === core.getCurrentDocUrl()) {
      closeDocumentPicker();
      return;
    }
    documentPickerController.setBusyDocument(docUrl);
    try {
      await switchToDocument(docUrl);
      closeDocumentPicker();
    } finally {
      documentPickerController.setBusyDocument(null);
    }
  };

  const deleteDocumentFromBrowser = async (docUrl: string): Promise<void> => {
    if (!documentPickerController.isOpen()) {
      return;
    }
    const confirmed = await confirmDestructiveAction({
      title: "Delete drawing?",
      message: "This drawing will be removed.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger",
      icon: Trash2,
    });
    if (!confirmed || runtimeStore.isDestroyed()) {
      return;
    }
    documentPickerController.setBusyDocument(docUrl);
    try {
      const deletingCurrent = docUrl === core.getCurrentDocUrl();
      if (deletingCurrent) {
        await flushThumbnailSave();
      }
      await documentBackend.deleteDocument(docUrl);
      if (deletingCurrent) {
        const remainingDocs = await documentBackend.listDocuments();
        const fallback = remainingDocs[0];
        if (fallback) {
          await switchToDocument(fallback.docUrl);
        } else {
          await createNewDocument({ mode: "normal" });
        }
      }
      await reloadDocumentPicker();
    } finally {
      documentPickerController.setBusyDocument(null);
    }
  };

  const flushThumbnailSave = async (): Promise<void> => {
    await documentSessionController.flushThumbnailSave();
  };

  const scheduleDocumentTouch = (): void => {
    documentSessionController.scheduleDocumentTouch();
  };

  const scheduleThumbnailSave = (
    delayMs = THUMBNAIL_SAVE_DEBOUNCE_MS,
  ): void => {
    documentSessionController.scheduleThumbnailSave(delayMs);
  };

  const onNewDrawingClick = async () => {
    const requestId = ++newDrawingRequestId;
    const destroyed = runtimeStore.isDestroyed();
    debugLifecycle("new-drawing:start", { requestId, destroyed });
    if (destroyed || requestId !== newDrawingRequestId) {
      return;
    }
    toolbarUiStore.setNewDrawingPending(true);
    try {
      documentPickerController.openCreateDialog();
    } finally {
      if (!runtimeStore.isDestroyed() && requestId === newDrawingRequestId) {
        toolbarUiStore.setNewDrawingPending(false);
      }
    }
    debugLifecycle("new-drawing:chooser-open", {
      requestId,
      currentRequestId: newDrawingRequestId,
      destroyed: runtimeStore.isDestroyed(),
    });
  };

  const onExportClick = async (): Promise<void> => {
    const size = getSize();
    const exported = await snapshotService.createPngExport({
      width: size.width,
      height: size.height,
    });
    if (!exported.blob && !exported.dataUrl) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `kids-draw-${timestamp}.png`;
    const blob = exported.blob;
    const picker = (
      window as unknown as {
        showSaveFilePicker?: SaveFilePickerLike;
      }
    ).showSaveFilePicker;

    if (blob && picker) {
      try {
        const fileHandle = await picker({
          suggestedName: fileName,
          types: [
            {
              description: "PNG Image",
              accept: { "image/png": [".png"] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    if (blob) {
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = fileName;
      link.rel = "noopener";
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      return;
    }

    if (!exported.dataUrl) {
      return;
    }
    const dataUrl = exported.dataUrl;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.rel = "noopener";
    link.click();
  };

  const onWindowResize = () => {
    scheduleResponsiveLayout();
  };

  listen(window, "resize", onWindowResize);
  if (window.visualViewport) {
    listen(window.visualViewport, "resize", onWindowResize);
  }
  for (const [familyId, button] of toolbar.familyButtons) {
    listen(
      button.el,
      "click",
      () => {
        toolbarStateController.activateFamilyTool(familyId);
      },
    );
  }
  for (const [toolId, button] of toolbar.directToolButtons) {
    listen(
      button.el,
      "click",
      () => {
        toolbarStateController.activateToolAndRemember(toolId);
      },
    );
  }
  for (const [toolId, button] of toolbar.variantButtons) {
    listen(
      button.el,
      "click",
      () => {
        toolbarStateController.activateToolAndRemember(toolId);
      },
    );
  }
  const onUndoClick = () => {
    store.undo();
    closeMobilePortraitActions();
  };
  const onRedoClick = () => {
    store.redo();
    closeMobilePortraitActions();
  };
  listen(toolbar.undoButton.el, "click", onUndoClick);
  listen(toolbar.redoButton.el, "click", onRedoClick);
  listen(mobilePortraitUndoMenuItem, "click", onUndoClick);
  listen(mobilePortraitRedoMenuItem, "click", onRedoClick);
  listen(mobilePortraitActionsTrigger.el, "click", (event) => {
    event.stopPropagation();
    toggleMobilePortraitActions();
  });
  listen(mobilePortraitColorsButton.el, "click", () => {
    if (layoutController.getCurrentLayoutProfile() !== "mobile-portrait") {
      return;
    }
    setMobilePortraitTopPanel("colors");
    applyToolbarLayoutProfile();
  });
  listen(mobilePortraitStrokesButton.el, "click", () => {
    if (layoutController.getCurrentLayoutProfile() !== "mobile-portrait") {
      return;
    }
    setMobilePortraitTopPanel("strokes");
    applyToolbarLayoutProfile();
  });
  const onClearClick = () => {
    void (async () => {
      const confirmed = await confirmDestructiveAction({
        title: "Clear drawing?",
        message: "This removes all strokes from the current drawing.",
        confirmLabel: "Clear",
        cancelLabel: "Keep Drawing",
        tone: "danger",
        icon: Trash2,
      });
      if (!confirmed || runtimeStore.isDestroyed()) {
        return;
      }

      const clearShapeId = `clear-${Date.now()}-${clearCounter++}`;
      store.applyAction(
        new ClearCanvas({
          id: clearShapeId,
          type: "clear",
          zIndex: getTopZIndex(store.getDocument()),
          geometry: { type: "clear" },
          style: {},
        }),
      );
      closeMobilePortraitActions();
    })();
  };
  listen(toolbar.clearButton.el, "click", onClearClick);
  listen(mobilePortraitClearMenuItem, "click", onClearClick);
  const onExportClickAndClose = () => {
    void onExportClick();
    closeMobilePortraitActions();
  };
  listen(toolbar.exportButton.el, "click", onExportClickAndClose);
  listen(mobilePortraitExportMenuItem, "click", onExportClickAndClose);
  const onNewDrawingClickAndClose = () => {
    void onNewDrawingClick();
    closeMobilePortraitActions();
  };
  listen(toolbar.newDrawingButton.el, "click", onNewDrawingClickAndClose);
  listen(mobilePortraitNewMenuItem, "click", onNewDrawingClickAndClose);
  const onBrowseClickAndClose = () => {
    void openDocumentPicker();
    closeMobilePortraitActions();
  };
  listen(toolbar.browseButton.el, "click", onBrowseClickAndClose);
  listen(mobilePortraitBrowseMenuItem, "click", onBrowseClickAndClose);
  for (const colorButton of toolbar.strokeColorSwatchButtons) {
    listen(colorButton, "click", () => {
      const strokeColor = colorButton.dataset.color;
      if (!strokeColor) {
        return;
      }
      store.updateSharedSettings({ strokeColor });
    });
  }
  for (const widthButton of toolbar.strokeWidthButtons) {
    listen(widthButton, "click", () => {
      const strokeWidth = Number(widthButton.dataset.size);
      if (!Number.isFinite(strokeWidth)) {
        return;
      }
      store.updateSharedSettings({ strokeWidth });
    });
  }
  listen(stage.overlay, "pointerdown", (event) => {
    inputSessionController.handlePointerDown(event as PointerEvent);
  });
  listen(stage.overlay, "pointermove", (event) => {
    inputSessionController.handlePointerMove(event as PointerEvent);
  });
  listen(stage.overlay, "pointerrawupdate", (event) => {
    inputSessionController.handlePointerRawUpdate(event as PointerEvent);
  });
  listen(stage.overlay, "pointerenter", (event) => {
    cursorOverlay.handlePointerEnter(event as PointerEvent);
  });
  listen(stage.overlay, "pointerup", (event) => {
    inputSessionController.handlePointerUp(event as PointerEvent);
  });
  listen(stage.overlay, "pointercancel", (event) => {
    inputSessionController.handlePointerCancel(event as PointerEvent);
  });
  listen(window, "pointerup", (event) => {
    inputSessionController.handlePointerUp(event as PointerEvent);
  });
  listen(window, "pointercancel", (event) => {
    inputSessionController.handlePointerCancel(event as PointerEvent);
  });
  listen(window, "pointerdown", (event) => {
    if (
      layoutController.getCurrentLayoutProfile() !== "mobile-portrait" ||
      !layoutController.isMobilePortraitActionsOpen()
    ) {
      return;
    }
    const target = event.target as Node | null;
    if (
      target &&
      (mobilePortraitTopStrip.contains(target) ||
        mobilePortraitActionsPopover.contains(target))
    ) {
      return;
    }
    closeMobilePortraitActions();
  });
  listen(stage.overlay, "lostpointercapture", () => {
    inputSessionController.forceCancelPointerSession();
  });
  listen(stage.overlay, "pointerleave", (_event) => {
    cursorOverlay.handlePointerLeave();
  });
  listen(window, "blur", () => {
    inputSessionController.forceCancelPointerSession();
  });
  listen(window, "resize", () => {
    positionMobilePortraitActionsPopover();
  });
  listen(window, "scroll", () => {
    positionMobilePortraitActionsPopover();
  });
  if (window.visualViewport) {
    listen(window.visualViewport, "resize", () => {
      positionMobilePortraitActionsPopover();
    });
    listen(window.visualViewport, "scroll", () => {
      positionMobilePortraitActionsPopover();
    });
  }
  listen(window, "keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }
    if (event.key === "Escape" && layoutController.isMobilePortraitActionsOpen()) {
      event.preventDefault();
      closeMobilePortraitActions();
      return;
    }
    if (event.key === "Escape" && documentPickerController.isOpen()) {
      event.preventDefault();
      closeDocumentPicker();
    }
  });
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      inputSessionController.forceCancelPointerSession();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);
  disposers.push(() =>
    document.removeEventListener("visibilitychange", handleVisibilityChange),
  );

  store.setOnRenderNeeded(() => {
    perfSession.onModelInvalidation();
    syncToolbarUi();
    renderLoopController.requestRenderFromModel();
  });

  applyDocumentPresentation({ mode: "normal" });
  applyToolbarStateForCurrentDocument({ mode: "normal" });
  const initialToolbarSignature = toolbarStateController.getCurrentToolbarSignature();
  void (async () => {
    const docUrl = core.getCurrentDocUrl();
    const presentation = resolveDocumentPresentation(
      store.getDocument().presentation,
    );
    await documentBackend.createDocument({
      docUrl,
      ...toDocumentMetadataFromPresentation(presentation),
      documentSize: store.getDocument().size,
    });
    if (docUrl !== core.getCurrentDocUrl()) {
      return;
    }
    applyDocumentPresentation(presentation);
    const currentToolbarSignature = toolbarStateController.getCurrentToolbarSignature();
    if (currentToolbarSignature !== initialToolbarSignature) {
      return;
    }
    applyToolbarStateForCurrentDocument(presentation);
  })();

  toolbarUiPersistence.start();
  documentSessionController.subscribeToCoreAdapter();
  scheduleDocumentTouch();
  renderLoopController.updateRenderIdentity();
  applyLayoutAndPixelRatio();
  renderLoopController.scheduleResizeBake();
  renderLoopController.requestRenderFromModel();

  return {
    destroy() {
      runtimeStore.setDestroyed(true);
      newDrawingRequestId += 1;
      debugLifecycle("destroy", { requestId: newDrawingRequestId });

      store.setOnRenderNeeded(undefined);
      toolbarUiPersistence.stop();
      toolbarUiPersistence.flush();
      documentSessionController.dispose();
      documentPickerController.dispose();
      layoutController.dispose();
      renderLoopController.dispose();

      for (const dispose of disposers) {
        dispose();
      }

      toolbar.destroy();
      pipeline.dispose();
      documentPickerOverlay.el.remove();
      if (!providedCore) {
        core.destroy();
      }
    },
  };
}
