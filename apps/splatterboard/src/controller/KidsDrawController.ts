import {
  ClearCanvas,
  type DrawingDocumentPresentation,
  type DrawingDocumentSize,
  type DrawingStore,
  getTopZIndex,
  type SmalldrawCore,
} from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import {
  renderOrderedShapes,
  type ShapeRendererRegistry,
} from "@smalldraw/renderer-canvas";
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
import {
  getColoringPageById,
} from "../coloring/catalog";
import type {
  KidsDocumentBackend,
  KidsDocumentMode,
  KidsDocumentSummary,
} from "../documents";
import {
  applyResponsiveLayout,
  getViewportPaddingForProfile,
  IMPLICIT_DOC_VERTICAL_SLACK,
  MIN_HEIGHT,
  MIN_WIDTH,
  normalizePixelRatio,
  type ResponsiveLayoutMode,
  type ResponsiveLayoutProfile,
  resolveLayoutProfile,
} from "../layout/responsiveLayout";
import { createKidsDrawPerfSession } from "../perf/kidsDrawPerf";
import type { RasterPipeline } from "../render/createRasterPipeline";
import {
  getDefaultToolIdForFamily,
  getFamilyIdForTool,
  getMatchingShapeFamilyToolId,
  getToolShapeVariant,
  getToolStyleSupport,
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
  $toolbarUi,
  loadPersistedToolbarUiState,
  type PersistedKidsUiStateV1,
  savePersistedToolbarUiState,
  setNewDrawingPending,
  setToolbarStyleUi,
  syncToolbarUiFromDrawingStore,
  type ToolbarUiState,
} from "../ui/stores/toolbarUiStore";
import {
  createDocumentBrowserOverlay,
  type NewDocumentRequest,
} from "../view/DocumentBrowserOverlay";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import {
  STROKE_WIDTH_OPTIONS,
  type KidsDrawToolbar,
} from "../view/KidsDrawToolbar";
import { createSquareIconButton } from "../view/SquareIconButton";
import { createCursorOverlayController } from "./createCursorOverlayController";

const RESIZE_BAKE_DEBOUNCE_MS = 120;
const THUMBNAIL_SAVE_DEBOUNCE_MS = 1000;
const MAX_POINTER_SAMPLES_PER_EVENT = 64;
const ENABLE_COALESCED_POINTER_SAMPLES = true;
const DEFAULT_OPAQUE_STROKE_COLOR = "#000000";
const DEFAULT_OPAQUE_FILL_COLOR = "#ffffff";
const UI_STATE_PERSIST_DEBOUNCE_MS = 150;
const MOBILE_ACTIONS_MENU_GAP_PX = 8;
const MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX = 8;
const NORMAL_DEFAULT_TOOL_ID = "brush.marker";
const COLORING_DEFAULT_TOOL_ID = "brush.marker";
const NORMAL_DEFAULT_STROKE_WIDTH = 8;
const COLORING_DEFAULT_STROKE_WIDTH = 24;

type RafRenderState = "idle" | "modelRequested" | "anticipatory";
type PointerEventWithCoalesced = PointerEvent & {
  getCoalescedEvents?: () => PointerEvent[];
};

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

interface ActiveDocumentPresentation {
  mode: KidsDocumentMode;
  coloringPageId?: string;
}

function getNearestStrokeWidthOption(strokeWidth: number): number {
  let nearest: number = STROKE_WIDTH_OPTIONS[0];
  let nearestDelta = Math.abs(strokeWidth - nearest);
  for (const option of STROKE_WIDTH_OPTIONS) {
    const delta = Math.abs(strokeWidth - option);
    if (delta < nearestDelta) {
      nearest = option;
      nearestDelta = delta;
    }
  }
  return nearest;
}

function resolveInitialToolbarUiStateFromPersistence(input: {
  catalog: KidsToolCatalog;
  current: {
    activeToolId: string;
    strokeColor: string;
    strokeWidth: number;
  };
  persisted: PersistedKidsUiStateV1 | null;
}): {
  activeToolId: string;
  strokeColor: string;
  strokeWidth: number;
} {
  const { catalog, current, persisted } = input;
  if (!persisted) {
    return current;
  }

  const toolIds = new Set(catalog.tools.map((tool) => tool.id));
  const activeToolId = toolIds.has(persisted.activeToolId)
    ? persisted.activeToolId
    : current.activeToolId;
  const strokeColor =
    persisted.strokeColor.trim().length > 0
      ? persisted.strokeColor.toLowerCase()
      : current.strokeColor;
  const strokeWidth =
    Number.isFinite(persisted.strokeWidth) && persisted.strokeWidth > 0
      ? getNearestStrokeWidthOption(persisted.strokeWidth)
      : current.strokeWidth;

  return {
    activeToolId,
    strokeColor,
    strokeWidth,
  };
}

export function createKidsDrawController(options: {
  store: DrawingStore;
  core: SmalldrawCore;
  toolbar: KidsDrawToolbar;
  catalog: KidsToolCatalog;
  shapeRendererRegistry: ShapeRendererRegistry;
  tools: KidsToolConfig[];
  families: KidsToolFamilyConfig[];
  stage: KidsDrawStage;
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

  let pointerIsDown = false;
  let drawingPerfFrameCount = 0;
  let rafRenderState: RafRenderState = "idle";
  let rafHandle: number | null = null;
  let layoutRafHandle: number | null = null;
  let debouncedResizeBakeHandle: ReturnType<typeof setTimeout> | null = null;
  let activePointerId: number | null = null;
  let lastPointerPoint = new Vec2(0, 0);
  let destroyed = false;
  let newDrawingRequestId = 0;
  let clearCounter = 0;
  let displayScale = 1;
  let displayWidth = getSize().width;
  let displayHeight = getSize().height;
  let currentLayoutProfile: ResponsiveLayoutProfile = resolveLayoutProfile(
    window.innerWidth,
    window.innerHeight,
  );
  let tilePixelRatio = normalizePixelRatio(
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
  );
  let currentRenderIdentity = "";
  let unsubscribeCoreAdapter: (() => void) | null = null;
  let unsubscribeToolbarUiPersistence: (() => void) | null = null;
  let metadataTouchTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let thumbnailSaveTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let toolbarUiPersistTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let pendingToolbarUiPersistState:
    | { docUrl: string; state: PersistedKidsUiStateV1 }
    | null = null;
  let lastPersistedToolbarUiSignature: string | null = null;
  let lastObservedToolbarUiSignature: string | null = null;
  let activeDocumentPresentation: ActiveDocumentPresentation = {
    mode: "normal",
  };
  let coloringOverlayLoadRequestId = 0;
  let browserDocuments: KidsDocumentSummary[] = [];
  let browserLoading = false;
  let browserBusyDocUrl: string | null = null;
  let browserRequestId = 0;
  let browserThumbnailUrlByDocUrl = new Map<string, string>();
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
  const selectedToolIdByFamily = new Map<string, string>(
    families.map((family) => [family.id, family.defaultToolId] as const),
  );
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
  let mobilePortraitActionsOpen = false;
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

  const documentBrowserOverlay = createDocumentBrowserOverlay({
    onClose: () => {
      closeDocumentBrowser();
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
  mount(appElement, documentBrowserOverlay.el);

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

  const toPersistedToolbarUiState = (
    state: Pick<ToolbarUiState, "activeToolId" | "strokeColor" | "strokeWidth">,
  ): PersistedKidsUiStateV1 => ({
    version: 1,
    activeToolId: state.activeToolId,
    strokeColor: state.strokeColor,
    strokeWidth: state.strokeWidth,
  });

  const getToolbarUiPersistSignature = (
    state: PersistedKidsUiStateV1,
  ): string => {
    return `${state.activeToolId}|${state.strokeColor}|${state.strokeWidth}`;
  };

  const flushToolbarUiPersistence = (): void => {
    if (!pendingToolbarUiPersistState) {
      return;
    }
    savePersistedToolbarUiState(
      pendingToolbarUiPersistState.docUrl,
      pendingToolbarUiPersistState.state,
    );
    lastPersistedToolbarUiSignature = getToolbarUiPersistSignature(
      pendingToolbarUiPersistState.state,
    );
    pendingToolbarUiPersistState = null;
  };

  const queueToolbarUiPersistence = (
    docUrl: string,
    state: PersistedKidsUiStateV1,
    signature: string,
  ): void => {
    if (signature === lastPersistedToolbarUiSignature) {
      return;
    }
    pendingToolbarUiPersistState = {
      docUrl,
      state,
    };
    if (toolbarUiPersistTimeoutHandle !== null) {
      clearTimeout(toolbarUiPersistTimeoutHandle);
    }
    toolbarUiPersistTimeoutHandle = setTimeout(() => {
      toolbarUiPersistTimeoutHandle = null;
      flushToolbarUiPersistence();
    }, UI_STATE_PERSIST_DEBOUNCE_MS);
  };

  const handleToolbarUiChangedForPersistence = (state: ToolbarUiState): void => {
    const docUrl = core.getCurrentDocUrl();
    const nextPersistedState = toPersistedToolbarUiState(state);
    const signature = getToolbarUiPersistSignature(nextPersistedState);
    if (signature === lastObservedToolbarUiSignature) {
      return;
    }
    lastObservedToolbarUiSignature = signature;
    queueToolbarUiPersistence(docUrl, nextPersistedState, signature);
  };

  const syncToolbarUi = (): void => {
    syncToolbarUiFromDrawingStore(store, {
      resolveActiveFamilyId: (toolId) => getFamilyIdForTool(toolId, catalog),
      resolveToolStyleSupport: (toolId) => getToolStyleSupport(toolId, catalog),
    });
    const toolbarUiState = $toolbarUi.get();
    mobilePortraitUndoMenuItem.disabled = !toolbarUiState.canUndo;
    mobilePortraitRedoMenuItem.disabled = !toolbarUiState.canRedo;
    mobilePortraitNewMenuItem.disabled = toolbar.newDrawingButton.el.disabled;
    cursorOverlay.sync();
  };

  const resolveDocumentPresentationFromData = (
    presentation: DrawingDocumentPresentation | undefined,
  ): ActiveDocumentPresentation => {
    if (
      presentation?.mode === "coloring" &&
      typeof presentation.coloringPageId === "string" &&
      presentation.coloringPageId.length > 0
    ) {
      return {
        mode: "coloring",
        coloringPageId: presentation.coloringPageId,
      };
    }
    return { mode: "normal" };
  };

  const resolveDocumentPresentation = (
    documentPresentation: DrawingDocumentPresentation | undefined,
  ): ActiveDocumentPresentation =>
    resolveDocumentPresentationFromData(documentPresentation);

  const getColoringOverlaySrc = (
    presentation: ActiveDocumentPresentation,
  ): string | null => {
    if (presentation.mode !== "coloring" || !presentation.coloringPageId) {
      return null;
    }
    const page = getColoringPageById(presentation.coloringPageId);
    return page?.src ?? null;
  };

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
      if (destroyed || requestId !== coloringOverlayLoadRequestId) {
        return;
      }
      registerRasterImage(overlaySrc, loader);
      requestRenderFromModel();
      scheduleThumbnailSave(0);
    };
    loader.src = overlaySrc;
  };

  const applyDocumentPresentation = (
    presentation: ActiveDocumentPresentation,
  ): void => {
    activeDocumentPresentation = presentation;
    const overlaySrc = getColoringOverlaySrc(presentation);
    pipeline.setColoringOverlaySource(overlaySrc);
    updateRenderIdentity();
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
    const defaultStrokeWidth =
      presentation.mode === "coloring"
        ? COLORING_DEFAULT_STROKE_WIDTH
        : NORMAL_DEFAULT_STROKE_WIDTH;
    const defaultToolId =
      presentation.mode === "coloring"
        ? COLORING_DEFAULT_TOOL_ID
        : NORMAL_DEFAULT_TOOL_ID;
    const docUrl = core.getCurrentDocUrl();
    const shared = store.getSharedSettings();
    const resolvedInitialToolbarUiState = resolveInitialToolbarUiStateFromPersistence(
      {
        catalog,
        current: {
          activeToolId: defaultToolId,
          strokeColor: DEFAULT_OPAQUE_STROKE_COLOR,
          strokeWidth: getNearestStrokeWidthOption(defaultStrokeWidth),
        },
        persisted: options?.forceDefaults
          ? null
          : loadPersistedToolbarUiState(docUrl),
      },
    );
    activateToolAndRemember(resolvedInitialToolbarUiState.activeToolId);
    store.updateSharedSettings({
      strokeColor: resolvedInitialToolbarUiState.strokeColor,
      strokeWidth: resolvedInitialToolbarUiState.strokeWidth,
      fillColor: shared.fillColor,
    });
    syncToolbarUi();
    const persistedState = toPersistedToolbarUiState($toolbarUi.get());
    const signature = getToolbarUiPersistSignature(persistedState);
    lastObservedToolbarUiSignature = signature;
    lastPersistedToolbarUiSignature = signature;
  };

  const setMobilePortraitActionsPopoverOpen = (open: boolean): void => {
    mobilePortraitActionsPopover.dataset.open = open ? "true" : "false";
    mobilePortraitActionsPopover.setAttribute("aria-hidden", open ? "false" : "true");
  };

  const positionMobilePortraitActionsPopover = (): void => {
    if (currentLayoutProfile !== "mobile-portrait" || !mobilePortraitActionsOpen) {
      return;
    }
    const triggerRect = mobilePortraitActionsTrigger.el.getBoundingClientRect();
    const popoverRect = mobilePortraitActionsPopover.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minLeft = MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX;
    const maxLeft =
      viewportWidth -
      MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX -
      popoverRect.width;
    const left = Math.max(
      minLeft,
      Math.min(triggerRect.right - popoverRect.width, maxLeft),
    );
    const belowTop = triggerRect.bottom + MOBILE_ACTIONS_MENU_GAP_PX;
    const aboveTop =
      triggerRect.top - MOBILE_ACTIONS_MENU_GAP_PX - popoverRect.height;
    const canPlaceAbove = aboveTop >= MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX;
    const wouldOverflowBottom =
      belowTop + popoverRect.height >
      viewportHeight - MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX;
    const top =
      wouldOverflowBottom && canPlaceAbove
        ? aboveTop
        : Math.max(
            MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX,
            Math.min(
              belowTop,
              viewportHeight -
                MOBILE_ACTIONS_MENU_VIEWPORT_PADDING_PX -
                popoverRect.height,
            ),
          );
    mobilePortraitActionsPopover.style.left = `${left}px`;
    mobilePortraitActionsPopover.style.top = `${top}px`;
  };

  const getRenderIdentity = (): string => {
    const size = getSize();
    const presentationIdentity =
      activeDocumentPresentation.mode === "coloring" &&
      activeDocumentPresentation.coloringPageId
        ? `coloring:${activeDocumentPresentation.coloringPageId}`
        : "normal";
    return [
      "kids-draw",
      `w:${size.width}`,
      `h:${size.height}`,
      `tile:256`,
      `dpr:${tilePixelRatio.toFixed(3)}`,
      `bg:${backgroundColor}`,
      `presentation:${presentationIdentity}`,
    ].join("|");
  };

  const scheduleAnimationFrame = (callback: FrameRequestCallback): number => {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(callback);
    }
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  };

  const cancelAnimationFrameHandle = (handle: number): void => {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle);
  };

  const renderPass = (): void => {
    const startMs = perfSession.recordRenderPassStart();
    if (pointerIsDown) {
      drawingPerfFrameCount += 1;
    }
    syncToolbarUi();
    pipeline.render();
    pipeline.updateDirtyRectOverlay();
    perfSession.recordRenderPassEnd(startMs);
  };

  const ensureRafScheduled = (): void => {
    if (rafHandle !== null) return;
    rafHandle = scheduleAnimationFrame(() => {
      rafHandle = null;
      perfSession.onRafFrameExecuted();
      if (rafRenderState === "idle") {
        return;
      }
      if (rafRenderState === "modelRequested") {
        renderPass();
        rafRenderState = "anticipatory";
        ensureRafScheduled();
        return;
      }
      rafRenderState = "idle";
    });
  };

  const requestRenderFromModel = (): void => {
    if (rafRenderState === "idle") {
      rafRenderState = "modelRequested";
      ensureRafScheduled();
      return;
    }
    if (rafRenderState === "anticipatory") {
      rafRenderState = "modelRequested";
    }
  };

  const scheduleResizeBake = (): void => {
    if (debouncedResizeBakeHandle !== null) {
      clearTimeout(debouncedResizeBakeHandle);
    }
    debouncedResizeBakeHandle = setTimeout(() => {
      debouncedResizeBakeHandle = null;
      pipeline.scheduleBakeForClear();
      pipeline.bakePendingTiles();
      requestRenderFromModel();
    }, RESIZE_BAKE_DEBOUNCE_MS);
  };

  const updateRenderIdentity = (): void => {
    const nextIdentity = getRenderIdentity();
    if (nextIdentity !== currentRenderIdentity) {
      currentRenderIdentity = nextIdentity;
      pipeline.setRenderIdentity(currentRenderIdentity);
    }
  };

  const resolveModeForProfile = (
    profile: ResponsiveLayoutProfile,
  ): ResponsiveLayoutMode => {
    if (profile === "large") {
      return "large";
    }
    if (profile === "medium") {
      return "medium";
    }
    return "mobile";
  };

  const getMobilePortraitTopPanel = (): "colors" | "strokes" => {
    return mobilePortraitStrokesButton.el.classList.contains("is-selected")
      ? "strokes"
      : "colors";
  };

  const setMobilePortraitTopPanel = (panel: "colors" | "strokes"): void => {
    mobilePortraitColorsButton.setSelected(panel === "colors");
    mobilePortraitStrokesButton.setSelected(panel === "strokes");
  };

  const syncMobilePortraitTopPanel = (): void => {
    const panel = getMobilePortraitTopPanel();
    const colorsPanel = toolbar.topElement.querySelector(
      ".kids-draw-toolbar-colors",
    ) as HTMLDivElement | null;
    const strokePanel = toolbar.topElement.querySelector(
      ".kids-draw-toolbar-strokes",
    ) as HTMLDivElement | null;
    if (colorsPanel) {
      colorsPanel.hidden = panel !== "colors";
    }
    if (strokePanel) {
      strokePanel.hidden = panel !== "strokes";
    }
  };

  const applyToolbarLayoutProfile = (
    profile: ResponsiveLayoutProfile,
  ): void => {
    const orientation =
      window.innerHeight > window.innerWidth ? "portrait" : "landscape";
    stage.viewportHost.dataset.layoutProfile = profile;
    stage.viewportHost.dataset.layoutMode = resolveModeForProfile(profile);
    stage.viewportHost.dataset.layoutOrientation = orientation;

    if (profile === "mobile-portrait") {
      syncMobilePortraitTopPanel();
      setChildren(mobilePortraitActionsPopover, [mobilePortraitActionsMenu]);
      mobilePortraitActionsPopover.hidden = false;
      setMobilePortraitActionsPopoverOpen(mobilePortraitActionsOpen);
      mobilePortraitActionsTrigger.el.setAttribute(
        "aria-expanded",
        mobilePortraitActionsOpen ? "true" : "false",
      );
      setChildren(mobilePortraitTopControls, [
        mobilePortraitColorsButton.el,
        mobilePortraitStrokesButton.el,
        mobilePortraitActionsTrigger.el,
      ]);
      setChildren(mobilePortraitTopStrip, [
        mobilePortraitTopControls,
        toolbar.topElement,
        mobilePortraitActionsPopover,
      ]);
      setChildren(mobilePortraitBottomStrip, [
        toolbar.bottomElement,
        toolbar.toolSelectorElement,
      ]);
      setChildren(stage.insetTopSlot, [mobilePortraitTopStrip]);
      setChildren(stage.insetLeftSlot, []);
      setChildren(stage.insetRightSlot, []);
      setChildren(stage.insetBottomSlot, [mobilePortraitBottomStrip]);
      toolbar.syncLayout();
      positionMobilePortraitActionsPopover();
      return;
    }

    mobilePortraitActionsOpen = false;
    setMobilePortraitTopPanel("colors");
    const colorsPanel = toolbar.topElement.querySelector(
      ".kids-draw-toolbar-colors",
    ) as HTMLDivElement | null;
    const strokePanel = toolbar.topElement.querySelector(
      ".kids-draw-toolbar-strokes",
    ) as HTMLDivElement | null;
    if (colorsPanel) {
      colorsPanel.hidden = false;
    }
    if (strokePanel) {
      strokePanel.hidden = false;
    }
    mobilePortraitActionsPopover.hidden = true;
    setMobilePortraitActionsPopoverOpen(false);
    mobilePortraitActionsTrigger.el.setAttribute("aria-expanded", "false");
    mobilePortraitActionsPopover.style.removeProperty("left");
    mobilePortraitActionsPopover.style.removeProperty("top");

    setChildren(stage.insetTopSlot, [toolbar.topElement]);
    setChildren(stage.insetLeftSlot, [toolbar.toolSelectorElement]);
    setChildren(stage.insetRightSlot, [toolbar.actionPanelElement]);
    setChildren(stage.insetBottomSlot, [toolbar.bottomElement]);
    toolbar.syncLayout();
  };

  const syncLayoutProfile = (): void => {
    currentLayoutProfile = resolveLayoutProfile(
      window.innerWidth,
      window.innerHeight,
    );
    applyToolbarLayoutProfile(currentLayoutProfile);
  };

  const closeMobilePortraitActions = (): void => {
    if (!mobilePortraitActionsOpen) {
      return;
    }
    mobilePortraitActionsOpen = false;
    if (currentLayoutProfile === "mobile-portrait") {
      applyToolbarLayoutProfile(currentLayoutProfile);
    }
  };

  const toggleMobilePortraitActions = (): void => {
    if (currentLayoutProfile !== "mobile-portrait") {
      return;
    }
    mobilePortraitActionsOpen = !mobilePortraitActionsOpen;
    applyToolbarLayoutProfile(currentLayoutProfile);
    if (mobilePortraitActionsOpen) {
      positionMobilePortraitActionsPopover();
    }
  };

  const getViewportPadding = (): {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } => getViewportPaddingForProfile(currentLayoutProfile);

  const resolveImplicitDocumentSizeFromViewport = (): {
    width: number;
    height: number;
  } => {
    const fallback = resolvePageSize();
    const host = stage.viewportHost;
    const hostWidth = Math.round(host.clientWidth);
    const hostHeight = Math.round(host.clientHeight);
    if (hostWidth <= 0 || hostHeight <= 0) {
      return fallback;
    }
    const styles = window.getComputedStyle(host);
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const width = Math.max(
      MIN_WIDTH,
      Math.round(hostWidth - paddingLeft - paddingRight),
    );
    const height = Math.max(
      MIN_HEIGHT,
      Math.round(
        hostHeight - paddingTop - paddingBottom - IMPLICIT_DOC_VERTICAL_SLACK,
      ),
    );
    return { width, height };
  };

  const applyCanvasSize = (nextWidth: number, nextHeight: number): void => {
    const size = getSize();
    if (size.width === nextWidth && size.height === nextHeight) {
      return;
    }
    setSize({ width: nextWidth, height: nextHeight });
    stage.setSceneDimensions(nextWidth, nextHeight);
    pipeline.updateViewport(nextWidth, nextHeight);
    updateRenderIdentity();
    const updated = applyResponsiveLayout({
      viewportHost: stage.viewportHost,
      canvasFrame: stage.canvasFrame,
      sceneRoot: stage.sceneRoot,
      width: nextWidth,
      height: nextHeight,
      displayScale,
      displayWidth,
      displayHeight,
      padding: getViewportPadding(),
    });
    displayScale = updated.displayScale;
    displayWidth = updated.displayWidth;
    displayHeight = updated.displayHeight;
    toolbar.syncLayout();
    scheduleAnimationFrame(() => {
      if (destroyed) {
        return;
      }
      toolbar.syncLayout();
    });
    scheduleResizeBake();
    requestRenderFromModel();
  };

  const applyLayoutAndPixelRatio = (): void => {
    syncLayoutProfile();
    const size = getSize();
    const updated = applyResponsiveLayout({
      viewportHost: stage.viewportHost,
      canvasFrame: stage.canvasFrame,
      sceneRoot: stage.sceneRoot,
      width: size.width,
      height: size.height,
      displayScale,
      displayWidth,
      displayHeight,
      padding: getViewportPadding(),
    });
    displayScale = updated.displayScale;
    displayWidth = updated.displayWidth;
    displayHeight = updated.displayHeight;

    const nextPixelRatio = normalizePixelRatio(
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    );
    if (nextPixelRatio !== tilePixelRatio) {
      tilePixelRatio = nextPixelRatio;
      pipeline.setTilePixelRatio(tilePixelRatio);
      updateRenderIdentity();
      scheduleResizeBake();
    }
    cursorOverlay.refreshMetrics();
    toolbar.syncLayout();
    scheduleAnimationFrame(() => {
      if (destroyed) {
        return;
      }
      toolbar.syncLayout();
    });
  };

  const scheduleResponsiveLayout = (): void => {
    if (layoutRafHandle !== null) {
      return;
    }
    layoutRafHandle = scheduleAnimationFrame(() => {
      layoutRafHandle = null;
      applyLayoutAndPixelRatio();
    });
  };

  const toPoint = (event: PointerEvent): Vec2 => {
    return cursorOverlay.toPoint(event);
  };

  const getPointerMoveSamples = (
    event: PointerEventWithCoalesced,
  ): { samples: PointerEvent[]; usedCoalesced: boolean } => {
    const coalesced = ENABLE_COALESCED_POINTER_SAMPLES
      ? event.getCoalescedEvents?.()
      : undefined;
    const rawSamples =
      coalesced && coalesced.length > 0 ? coalesced : [event as PointerEvent];
    const cappedSamples =
      rawSamples.length > MAX_POINTER_SAMPLES_PER_EVENT
        ? rawSamples.slice(rawSamples.length - MAX_POINTER_SAMPLES_PER_EVENT)
        : rawSamples;
    const samples: PointerEvent[] = [];
    for (const sample of cappedSamples) {
      const previous = samples[samples.length - 1];
      if (
        previous &&
        previous.clientX === sample.clientX &&
        previous.clientY === sample.clientY
      ) {
        continue;
      }
      samples.push(sample);
    }
    if (samples.length === 0) {
      samples.push(event);
    }
    return {
      samples,
      usedCoalesced: Boolean(coalesced && coalesced.length > 0),
    };
  };

  const subscribeToCoreAdapter = () => {
    unsubscribeCoreAdapter?.();
    unsubscribeCoreAdapter = core.storeAdapter.subscribe((doc) => {
      store.applyDocument(doc);
      scheduleDocumentTouch();
      scheduleThumbnailSave();
      syncToolbarUi();
    });
  };

  const renderDocumentBrowser = (): void => {
    documentBrowserOverlay.setLoading(browserLoading);
    documentBrowserOverlay.setBusyDocument(browserBusyDocUrl);
    documentBrowserOverlay.setDocuments(
      browserDocuments,
      core.getCurrentDocUrl(),
      browserThumbnailUrlByDocUrl,
    );
  };

  const clearBrowserThumbnails = (): void => {
    for (const url of browserThumbnailUrlByDocUrl.values()) {
      URL.revokeObjectURL(url);
    }
    browserThumbnailUrlByDocUrl = new Map();
  };

  const loadBrowserThumbnails = async (
    requestId: number,
    documents: KidsDocumentSummary[],
  ): Promise<void> => {
    const nextThumbnailUrlByDocUrl = new Map<string, string>();
    for (const document of documents) {
      try {
        const thumbnailBlob = await documentBackend.getThumbnail(
          document.docUrl,
        );
        if (!thumbnailBlob) {
          continue;
        }
        nextThumbnailUrlByDocUrl.set(
          document.docUrl,
          URL.createObjectURL(thumbnailBlob),
        );
      } catch (error) {
        console.warn("[kids-draw:documents] failed to load thumbnail", {
          docUrl: document.docUrl,
          error,
        });
      }
    }
    if (requestId !== browserRequestId) {
      for (const url of nextThumbnailUrlByDocUrl.values()) {
        URL.revokeObjectURL(url);
      }
      return;
    }

    clearBrowserThumbnails();
    browserThumbnailUrlByDocUrl = nextThumbnailUrlByDocUrl;
    renderDocumentBrowser();
  };

  const closeDocumentBrowser = (): void => {
    documentBrowserOverlay.setOpen(false);
    browserBusyDocUrl = null;
    renderDocumentBrowser();
  };

  const reloadDocumentBrowser = async (): Promise<void> => {
    const requestId = ++browserRequestId;
    browserLoading = true;
    renderDocumentBrowser();
    try {
      const documents = await documentBackend.listDocuments();
      if (requestId !== browserRequestId) {
        return;
      }
      browserDocuments = documents;
      await loadBrowserThumbnails(requestId, documents);
    } finally {
      if (requestId === browserRequestId) {
        browserLoading = false;
        renderDocumentBrowser();
      }
    }
  };

  const openDocumentBrowser = async (): Promise<void> => {
    documentBrowserOverlay.setOpen(true);
    browserBusyDocUrl = null;
    renderDocumentBrowser();
    await reloadDocumentBrowser();
  };

  const getPresentationForCreateRequest = (
    request: NewDocumentRequest,
  ): DrawingDocumentPresentation => {
    if (request.mode === "normal") {
      return { mode: "normal" };
    }
    return {
      mode: "coloring",
      coloringPageId: request.coloringPageId,
    };
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

  const switchToDocument = async (docUrl: string): Promise<void> => {
    await flushThumbnailSave();
    const adapter = await core.open(docUrl);
    const openedDocument = adapter.getDoc();
    const docSize = openedDocument.size;
    const presentation = resolveDocumentPresentation(openedDocument.presentation);
    await documentBackend.createDocument({
      docUrl,
      mode: presentation.mode,
      coloringPageId: presentation.coloringPageId,
      documentSize: docSize,
    });
    await documentBackend.touchDocument(docUrl);
    store.resetToDocument(openedDocument);
    applyCanvasSize(docSize.width, docSize.height);
    applyDocumentPresentation(presentation);
    applyToolbarStateForCurrentDocument(presentation);
    subscribeToCoreAdapter();
    pipeline.scheduleBakeForClear();
    pipeline.bakePendingTiles();
    requestRenderFromModel();
  };

  const createNewDocument = async (
    request: NewDocumentRequest,
  ): Promise<void> => {
    const requestPresentation = getPresentationForCreateRequest(request);
    const nextDocumentSize = getDocumentSizeForCreateRequest(request);
    await flushThumbnailSave();
    const { adapter, url } = await core.createNew({
      documentSize: nextDocumentSize,
      documentPresentation: requestPresentation,
    });
    const createdDocument = adapter.getDoc();
    const presentation = resolveDocumentPresentation(createdDocument.presentation);
    await documentBackend.createDocument({
      docUrl: url,
      mode: presentation.mode,
      coloringPageId: presentation.coloringPageId,
      documentSize: nextDocumentSize,
    });
    store.resetToDocument(createdDocument);
    applyCanvasSize(nextDocumentSize.width, nextDocumentSize.height);
    applyDocumentPresentation(presentation);
    applyToolbarStateForCurrentDocument(presentation, { forceDefaults: true });
    subscribeToCoreAdapter();
    pipeline.scheduleBakeForClear();
    pipeline.bakePendingTiles();
    requestRenderFromModel();
  };

  const createNewDocumentFromBrowser = async (
    request: NewDocumentRequest,
  ): Promise<void> => {
    if (
      !documentBrowserOverlay.isOpen() &&
      !documentBrowserOverlay.isCreateDialogOpen()
    ) {
      return;
    }
    browserBusyDocUrl = "__new__";
    renderDocumentBrowser();
    try {
      await createNewDocument(request);
      closeDocumentBrowser();
      documentBrowserOverlay.closeCreateDialog();
    } finally {
      browserBusyDocUrl = null;
      renderDocumentBrowser();
    }
  };

  const openDocumentFromBrowser = async (docUrl: string): Promise<void> => {
    if (!documentBrowserOverlay.isOpen()) {
      return;
    }
    if (docUrl === core.getCurrentDocUrl()) {
      closeDocumentBrowser();
      return;
    }
    browserBusyDocUrl = docUrl;
    renderDocumentBrowser();
    try {
      await switchToDocument(docUrl);
      closeDocumentBrowser();
    } finally {
      browserBusyDocUrl = null;
      renderDocumentBrowser();
    }
  };

  const deleteDocumentFromBrowser = async (docUrl: string): Promise<void> => {
    if (!documentBrowserOverlay.isOpen()) {
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
    if (!confirmed || destroyed) {
      return;
    }
    browserBusyDocUrl = docUrl;
    renderDocumentBrowser();
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
      await reloadDocumentBrowser();
    } finally {
      browserBusyDocUrl = null;
      renderDocumentBrowser();
    }
  };

  const flushDocumentTouch = async (): Promise<void> => {
    const docUrl = core.getCurrentDocUrl();
    try {
      await documentBackend.touchDocument(docUrl);
    } catch (error) {
      console.warn("[kids-draw:documents] failed to touch document", {
        docUrl,
        error,
      });
    }
  };

  const drawColoringOverlay = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void => {
    const overlaySrc = getColoringOverlaySrc(activeDocumentPresentation);
    if (!overlaySrc) {
      return;
    }
    const image = getLoadedRasterImage(overlaySrc);
    if (!image) {
      return;
    }
    ctx.drawImage(image, 0, 0, width, height);
  };

  const createThumbnailBlob = async (): Promise<Blob | null> => {
    const doc = store.getDocument();
    const width = Math.max(1, Math.round(doc.size.width));
    const height = Math.max(1, Math.round(doc.size.height));
    const maxDimension = 640;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.toBlob !== "function") {
      return null;
    }

    ctx.save();
    ctx.scale(scale, scale);
    renderOrderedShapes(ctx, store.getOrderedShapes(), {
      registry: shapeRendererRegistry,
      geometryHandlerRegistry: store.getShapeHandlers(),
    });
    drawColoringOverlay(ctx, width, height);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.restore();

    return await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/webp", 0.82);
    });
  };

  const flushThumbnailSave = async (): Promise<void> => {
    const docUrl = core.getCurrentDocUrl();
    try {
      const thumbnailBlob = await createThumbnailBlob();
      if (!thumbnailBlob) {
        return;
      }
      await documentBackend.saveThumbnail(docUrl, thumbnailBlob);
    } catch (error) {
      console.warn("[kids-draw:documents] failed to save thumbnail", {
        docUrl,
        error,
      });
    }
  };

  const scheduleDocumentTouch = (): void => {
    if (metadataTouchTimeoutHandle !== null) {
      clearTimeout(metadataTouchTimeoutHandle);
    }
    metadataTouchTimeoutHandle = setTimeout(() => {
      metadataTouchTimeoutHandle = null;
      void flushDocumentTouch();
    }, 500);
  };

  const scheduleThumbnailSave = (
    delayMs = THUMBNAIL_SAVE_DEBOUNCE_MS,
  ): void => {
    if (thumbnailSaveTimeoutHandle !== null) {
      clearTimeout(thumbnailSaveTimeoutHandle);
    }
    thumbnailSaveTimeoutHandle = setTimeout(() => {
      thumbnailSaveTimeoutHandle = null;
      void flushThumbnailSave();
    }, delayMs);
  };

  const runAndSync = (fn: () => void): (() => void) => {
    return () => {
      fn();
      syncToolbarUi();
    };
  };

  const sanitizeTransparentStylesForTool = (toolId: string): void => {
    const support = getToolStyleSupport(toolId, catalog);
    const shared = store.getSharedSettings();
    const nextSettings: Partial<typeof shared> = {};
    if (
      shared.strokeColor === "transparent" &&
      !support.transparentStrokeColor
    ) {
      nextSettings.strokeColor = DEFAULT_OPAQUE_STROKE_COLOR;
    }
    if (shared.fillColor === "transparent" && !support.transparentFillColor) {
      nextSettings.fillColor = DEFAULT_OPAQUE_FILL_COLOR;
    }
    if (Object.keys(nextSettings).length > 0) {
      store.updateSharedSettings(nextSettings);
    }
  };

  const activateToolAndRemember = (toolId: string): void => {
    store.activateTool(toolId);
    sanitizeTransparentStylesForTool(toolId);
    const familyId = getFamilyIdForTool(toolId, catalog);
    if (!familyId) {
      return;
    }
    selectedToolIdByFamily.set(familyId, toolId);
  };

  const onNewDrawingClick = async () => {
    const requestId = ++newDrawingRequestId;
    debugLifecycle("new-drawing:start", { requestId, destroyed });
    if (destroyed || requestId !== newDrawingRequestId) {
      return;
    }
    setNewDrawingPending(true);
    try {
      documentBrowserOverlay.openCreateDialog();
    } finally {
      if (!destroyed && requestId === newDrawingRequestId) {
        setNewDrawingPending(false);
      }
    }
    debugLifecycle("new-drawing:chooser-open", {
      requestId,
      currentRequestId: newDrawingRequestId,
      destroyed,
    });
  };

  const onExportClick = async (): Promise<void> => {
    const size = getSize();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.max(1, Math.round(size.width));
    exportCanvas.height = Math.max(1, Math.round(size.height));
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx || typeof exportCanvas.toDataURL !== "function") {
      return;
    }

    renderOrderedShapes(exportCtx, store.getOrderedShapes(), {
      registry: shapeRendererRegistry,
      geometryHandlerRegistry: store.getShapeHandlers(),
    });
    drawColoringOverlay(exportCtx, exportCanvas.width, exportCanvas.height);
    exportCtx.save();
    exportCtx.globalCompositeOperation = "destination-over";
    exportCtx.fillStyle = backgroundColor;
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.restore();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `kids-draw-${timestamp}.png`;
    const blob: Blob | null =
      typeof exportCanvas.toBlob === "function"
        ? await new Promise((resolve) => {
            exportCanvas.toBlob((result) => resolve(result), "image/png");
          })
        : null;
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

    const dataUrl = exportCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.rel = "noopener";
    link.click();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (pointerIsDown) {
      return;
    }
    event.preventDefault();
    cursorOverlay.handlePointerDown(event);
    pointerIsDown = true;
    activePointerId = event.pointerId;
    cursorOverlay.setDrawingActive(pointerIsDown);
    drawingPerfFrameCount = 0;
    perfSession.begin();
    lastPointerPoint = toPoint(event);
    store.dispatch("pointerDown", {
      point: lastPointerPoint,
      buttons: event.buttons,
    });
    stage.overlay.setPointerCapture?.(event.pointerId);
    syncToolbarUi();
  };
  const onPointerMove = (event: PointerEventWithCoalesced) => {
    cursorOverlay.handlePointerMove(event);
    const { samples, usedCoalesced } = getPointerMoveSamples(event);
    const pointerSamples = samples.map((sample) => ({
      point: toPoint(sample),
      buttons: sample.buttons,
      pressure: sample.pressure,
      shiftKey: sample.shiftKey,
      altKey: sample.altKey,
    }));
    const finalPoint = pointerSamples[pointerSamples.length - 1]?.point;
    if (finalPoint) {
      lastPointerPoint = finalPoint;
    }
    perfSession.onPointerMoveSamples(pointerSamples.length, usedCoalesced);
    store.dispatchBatch("pointerMove", pointerSamples);
  };

  const onPointerRawUpdate = (event: PointerEvent): void => {
    cursorOverlay.handlePointerRawUpdate(event);
  };
  const endPointerSession = (
    event: PointerEvent,
    type: "pointerUp" | "pointerCancel",
  ) => {
    if (!pointerIsDown) {
      return;
    }
    if (activePointerId !== null && event.pointerId !== activePointerId) {
      return;
    }
    lastPointerPoint = toPoint(event);
    const committedToolId = store.getActiveToolId();
    store.dispatch(type, { point: lastPointerPoint, buttons: event.buttons });
    if (type === "pointerUp" && committedToolId?.startsWith("stamp.")) {
      cursorOverlay.playStampCommit(lastPointerPoint);
    }
    pointerIsDown = false;
    activePointerId = null;
    cursorOverlay.setDrawingActive(pointerIsDown);
    perfSession.end(drawingPerfFrameCount);
    if (type === "pointerUp") {
      stage.overlay.releasePointerCapture?.(event.pointerId);
      scheduleThumbnailSave(140);
    }
    syncToolbarUi();
  };

  const forceCancelPointerSession = () => {
    if (!pointerIsDown) {
      return;
    }
    store.dispatch("pointerCancel", { point: lastPointerPoint, buttons: 0 });
    pointerIsDown = false;
    activePointerId = null;
    cursorOverlay.setDrawingActive(pointerIsDown);
    perfSession.end(drawingPerfFrameCount);
    syncToolbarUi();
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
      runAndSync(() => {
        const activeToolId = store.getActiveToolId() ?? "";
        const activeShapeVariant =
          getToolShapeVariant(activeToolId, catalog) ??
          (activeToolId.includes("ellipse")
            ? "ellipse"
            : activeToolId.includes("rect")
              ? "rect"
              : undefined);
        const matchingShapeToolId = getMatchingShapeFamilyToolId({
          familyId,
          shapeVariant: activeShapeVariant,
          catalog,
        });
        const toolId =
          matchingShapeToolId ??
          selectedToolIdByFamily.get(familyId) ??
          getDefaultToolIdForFamily(familyId, catalog);
        activateToolAndRemember(toolId);
      }),
    );
  }
  for (const [toolId, button] of toolbar.directToolButtons) {
    listen(
      button.el,
      "click",
      runAndSync(() => {
        activateToolAndRemember(toolId);
      }),
    );
  }
  for (const [toolId, button] of toolbar.variantButtons) {
    listen(
      button.el,
      "click",
      runAndSync(() => {
        activateToolAndRemember(toolId);
      }),
    );
  }
  const onUndoClick = runAndSync(() => {
    store.undo();
    closeMobilePortraitActions();
  });
  const onRedoClick = runAndSync(() => {
    store.redo();
    closeMobilePortraitActions();
  });
  listen(toolbar.undoButton.el, "click", onUndoClick);
  listen(toolbar.redoButton.el, "click", onRedoClick);
  listen(mobilePortraitUndoMenuItem, "click", onUndoClick);
  listen(mobilePortraitRedoMenuItem, "click", onRedoClick);
  listen(mobilePortraitActionsTrigger.el, "click", (event) => {
    event.stopPropagation();
    toggleMobilePortraitActions();
  });
  listen(mobilePortraitColorsButton.el, "click", () => {
    if (currentLayoutProfile !== "mobile-portrait") {
      return;
    }
    setMobilePortraitTopPanel("colors");
    applyToolbarLayoutProfile(currentLayoutProfile);
  });
  listen(mobilePortraitStrokesButton.el, "click", () => {
    if (currentLayoutProfile !== "mobile-portrait") {
      return;
    }
    setMobilePortraitTopPanel("strokes");
    applyToolbarLayoutProfile(currentLayoutProfile);
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
      if (!confirmed || destroyed) {
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
      syncToolbarUi();
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
    void openDocumentBrowser();
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
      const shared = store.getSharedSettings();
      setToolbarStyleUi(
        shared.strokeColor,
        shared.fillColor,
        shared.strokeWidth,
      );
    });
  }
  for (const widthButton of toolbar.strokeWidthButtons) {
    listen(widthButton, "click", () => {
      const strokeWidth = Number(widthButton.dataset.size);
      if (!Number.isFinite(strokeWidth)) {
        return;
      }
      store.updateSharedSettings({ strokeWidth });
      const shared = store.getSharedSettings();
      setToolbarStyleUi(
        shared.strokeColor,
        shared.fillColor,
        shared.strokeWidth,
      );
    });
  }
  listen(stage.overlay, "pointerdown", onPointerDown);
  listen(stage.overlay, "pointermove", onPointerMove);
  listen(stage.overlay, "pointerrawupdate", (event) => {
    onPointerRawUpdate(event as PointerEvent);
  });
  listen(stage.overlay, "pointerenter", (event) => {
    cursorOverlay.handlePointerEnter(event as PointerEvent);
  });
  listen(stage.overlay, "pointerup", (event) => {
    endPointerSession(event, "pointerUp");
  });
  listen(stage.overlay, "pointercancel", (event) => {
    endPointerSession(event, "pointerCancel");
  });
  listen(window, "pointerup", (event) => {
    endPointerSession(event as PointerEvent, "pointerUp");
  });
  listen(window, "pointercancel", (event) => {
    endPointerSession(event as PointerEvent, "pointerCancel");
  });
  listen(window, "pointerdown", (event) => {
    if (
      currentLayoutProfile !== "mobile-portrait" ||
      !mobilePortraitActionsOpen
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
    forceCancelPointerSession();
  });
  listen(stage.overlay, "pointerleave", (_event) => {
    cursorOverlay.handlePointerLeave();
  });
  listen(window, "blur", () => {
    forceCancelPointerSession();
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
    if (event.key === "Escape" && mobilePortraitActionsOpen) {
      event.preventDefault();
      closeMobilePortraitActions();
      return;
    }
    if (event.key === "Escape" && documentBrowserOverlay.isOpen()) {
      event.preventDefault();
      closeDocumentBrowser();
    }
  });
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      forceCancelPointerSession();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);
  disposers.push(() =>
    document.removeEventListener("visibilitychange", handleVisibilityChange),
  );

  store.setOnRenderNeeded(() => {
    perfSession.onModelInvalidation();
    requestRenderFromModel();
  });

  applyDocumentPresentation({ mode: "normal" });
  applyToolbarStateForCurrentDocument({ mode: "normal" });
  const initialToolbarSignature = getToolbarUiPersistSignature(
    toPersistedToolbarUiState($toolbarUi.get()),
  );
  void (async () => {
    const docUrl = core.getCurrentDocUrl();
    const presentation = resolveDocumentPresentation(
      store.getDocument().presentation,
    );
    await documentBackend.createDocument({
      docUrl,
      mode: presentation.mode,
      coloringPageId: presentation.coloringPageId,
      documentSize: store.getDocument().size,
    });
    if (docUrl !== core.getCurrentDocUrl()) {
      return;
    }
    applyDocumentPresentation(presentation);
    const currentToolbarSignature = getToolbarUiPersistSignature(
      toPersistedToolbarUiState($toolbarUi.get()),
    );
    if (currentToolbarSignature !== initialToolbarSignature) {
      return;
    }
    applyToolbarStateForCurrentDocument(presentation);
  })();

  unsubscribeToolbarUiPersistence = $toolbarUi.subscribe((state) => {
    handleToolbarUiChangedForPersistence(state);
  });
  subscribeToCoreAdapter();
  scheduleDocumentTouch();
  updateRenderIdentity();
  applyLayoutAndPixelRatio();
  scheduleResizeBake();
  requestRenderFromModel();

  return {
    destroy() {
      destroyed = true;
      newDrawingRequestId += 1;
      debugLifecycle("destroy", { requestId: newDrawingRequestId });

      store.setOnRenderNeeded(undefined);
      unsubscribeCoreAdapter?.();
      unsubscribeCoreAdapter = null;
      unsubscribeToolbarUiPersistence?.();
      unsubscribeToolbarUiPersistence = null;
      if (toolbarUiPersistTimeoutHandle !== null) {
        clearTimeout(toolbarUiPersistTimeoutHandle);
        toolbarUiPersistTimeoutHandle = null;
      }
      flushToolbarUiPersistence();
      if (metadataTouchTimeoutHandle !== null) {
        clearTimeout(metadataTouchTimeoutHandle);
        metadataTouchTimeoutHandle = null;
      }
      if (thumbnailSaveTimeoutHandle !== null) {
        clearTimeout(thumbnailSaveTimeoutHandle);
        thumbnailSaveTimeoutHandle = null;
      }
      clearBrowserThumbnails();

      if (layoutRafHandle !== null) {
        cancelAnimationFrameHandle(layoutRafHandle);
        layoutRafHandle = null;
      }
      if (debouncedResizeBakeHandle !== null) {
        clearTimeout(debouncedResizeBakeHandle);
        debouncedResizeBakeHandle = null;
      }
      if (rafHandle !== null) {
        cancelAnimationFrameHandle(rafHandle);
        rafHandle = null;
      }

      for (const dispose of disposers) {
        dispose();
      }

      toolbar.destroy();
      pipeline.dispose();
      documentBrowserOverlay.el.remove();
      if (!providedCore) {
        core.destroy();
      }
    },
  };
}
