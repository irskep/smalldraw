import {
  ClearCanvas,
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
  FilePlus,
  type IconNode,
  MoreHorizontal,
  Palette,
  SlidersHorizontal,
  Trash2,
} from "lucide";
import type { KidsDocumentBackend, KidsDocumentSummary } from "../documents";
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
  setNewDrawingPending,
  setToolbarStyleUi,
  syncToolbarUiFromDrawingStore,
} from "../ui/stores/toolbarUiStore";
import { createDocumentBrowserOverlay } from "../view/DocumentBrowserOverlay";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";
import { createSquareIconButton } from "../view/SquareIconButton";
import { createCursorOverlayController } from "./createCursorOverlayController";

const RESIZE_BAKE_DEBOUNCE_MS = 120;
const THUMBNAIL_SAVE_DEBOUNCE_MS = 1000;
const MAX_POINTER_SAMPLES_PER_EVENT = 64;
const ENABLE_COALESCED_POINTER_SAMPLES = true;
const DEFAULT_OPAQUE_STROKE_COLOR = "#000000";
const DEFAULT_OPAQUE_FILL_COLOR = "#ffffff";

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
  let metadataTouchTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let thumbnailSaveTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
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
      "aria-expanded": "false",
    },
  });
  const mobilePortraitActionsPopover = document.createElement("div");
  mobilePortraitActionsPopover.className = "kids-draw-mobile-actions-popover";
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
    onNewDocument: () => {
      void createNewDocumentFromBrowser();
    },
    onOpenDocument: (docUrl) => {
      void openDocumentFromBrowser(docUrl);
    },
    onDeleteDocument: (docUrl) => {
      void deleteDocumentFromBrowser(docUrl);
    },
  });
  appElement.appendChild(documentBrowserOverlay.el);

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

  const syncToolbarUi = (): void => {
    syncToolbarUiFromDrawingStore(store, {
      resolveActiveFamilyId: (toolId) => getFamilyIdForTool(toolId, catalog),
      resolveToolStyleSupport: (toolId) => getToolStyleSupport(toolId, catalog),
    });
    cursorOverlay.sync();
  };

  const getRenderIdentity = (): string => {
    const size = getSize();
    return [
      "kids-draw",
      `w:${size.width}`,
      `h:${size.height}`,
      `tile:256`,
      `dpr:${tilePixelRatio.toFixed(3)}`,
      `bg:${backgroundColor}`,
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
      mobilePortraitActionsPopover.replaceChildren(toolbar.actionPanelElement);
      mobilePortraitActionsPopover.hidden = !mobilePortraitActionsOpen;
      mobilePortraitActionsTrigger.el.setAttribute(
        "aria-expanded",
        mobilePortraitActionsOpen ? "true" : "false",
      );
      mobilePortraitTopControls.replaceChildren(
        mobilePortraitColorsButton.el,
        mobilePortraitStrokesButton.el,
        mobilePortraitActionsTrigger.el,
      );
      mobilePortraitTopStrip.replaceChildren(
        mobilePortraitTopControls,
        toolbar.topElement,
        mobilePortraitActionsPopover,
      );
      mobilePortraitBottomStrip.replaceChildren(
        toolbar.bottomElement,
        toolbar.toolSelectorElement,
      );
      stage.insetTopSlot.replaceChildren(mobilePortraitTopStrip);
      stage.insetLeftSlot.replaceChildren();
      stage.insetRightSlot.replaceChildren();
      stage.insetBottomSlot.replaceChildren(mobilePortraitBottomStrip);
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
    mobilePortraitActionsTrigger.el.setAttribute("aria-expanded", "false");

    stage.insetTopSlot.replaceChildren(toolbar.topElement);
    stage.insetLeftSlot.replaceChildren(toolbar.toolSelectorElement);
    stage.insetRightSlot.replaceChildren(toolbar.actionPanelElement);
    stage.insetBottomSlot.replaceChildren(toolbar.bottomElement);
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

  const switchToDocument = async (docUrl: string): Promise<void> => {
    await flushThumbnailSave();
    const adapter = await core.open(docUrl);
    await documentBackend.touchDocument(docUrl);
    store.resetToDocument(adapter.getDoc());
    applyCanvasSize(adapter.getDoc().size.width, adapter.getDoc().size.height);
    subscribeToCoreAdapter();
    pipeline.scheduleBakeForClear();
    pipeline.bakePendingTiles();
    requestRenderFromModel();
    syncToolbarUi();
  };

  const createNewDocument = async (
    nextDocumentSize: DrawingDocumentSize,
  ): Promise<void> => {
    await flushThumbnailSave();
    const { adapter, url } = await core.createNew({
      documentSize: nextDocumentSize,
    });
    await documentBackend.createDocument({
      docUrl: url,
      documentSize: nextDocumentSize,
    });
    store.resetToDocument(adapter.getDoc());
    applyCanvasSize(nextDocumentSize.width, nextDocumentSize.height);
    subscribeToCoreAdapter();
    pipeline.scheduleBakeForClear();
    pipeline.bakePendingTiles();
    requestRenderFromModel();
    syncToolbarUi();
  };

  const createNewDocumentFromBrowser = async (): Promise<void> => {
    if (!documentBrowserOverlay.isOpen()) {
      return;
    }
    browserBusyDocUrl = "__new__";
    renderDocumentBrowser();
    try {
      const nextDocumentSize = hasExplicitSize
        ? getExplicitSize()
        : resolveImplicitDocumentSizeFromViewport();
      await createNewDocument(nextDocumentSize);
      closeDocumentBrowser();
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
          const nextDocumentSize = hasExplicitSize
            ? getExplicitSize()
            : resolveImplicitDocumentSizeFromViewport();
          await createNewDocument(nextDocumentSize);
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
    const confirmed = await confirmDestructiveAction({
      title: "Start a new drawing?",
      message: "Your current drawing will be replaced by a blank page.",
      confirmLabel: "Start New",
      cancelLabel: "Cancel",
      tone: "danger",
      icon: FilePlus,
    });
    if (!confirmed || destroyed) {
      return;
    }

    const requestId = ++newDrawingRequestId;
    debugLifecycle("new-drawing:start", { requestId, destroyed });
    setNewDrawingPending(true);
    try {
      const nextDocumentSize = hasExplicitSize
        ? getExplicitSize()
        : resolveImplicitDocumentSizeFromViewport();
      await createNewDocument(nextDocumentSize);
      debugLifecycle("new-drawing:reset-resolved", { requestId, destroyed });
      if (destroyed || requestId !== newDrawingRequestId) {
        debugLifecycle("new-drawing:aborted-after-reset", {
          requestId,
          currentRequestId: newDrawingRequestId,
          destroyed,
        });
        return;
      }
      closeDocumentBrowser();
    } finally {
      if (!destroyed && requestId === newDrawingRequestId) {
        setNewDrawingPending(false);
      }
      debugLifecycle("new-drawing:done", {
        requestId,
        currentRequestId: newDrawingRequestId,
        destroyed,
      });
    }
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
  listen(
    toolbar.undoButton.el,
    "click",
    runAndSync(() => {
      store.undo();
      closeMobilePortraitActions();
    }),
  );
  listen(
    toolbar.redoButton.el,
    "click",
    runAndSync(() => {
      store.redo();
      closeMobilePortraitActions();
    }),
  );
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
  listen(toolbar.clearButton.el, "click", () => {
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
  });
  listen(toolbar.exportButton.el, "click", () => {
    void onExportClick();
    closeMobilePortraitActions();
  });
  listen(toolbar.newDrawingButton.el, "click", () => {
    void onNewDrawingClick();
    closeMobilePortraitActions();
  });
  listen(toolbar.browseButton.el, "click", () => {
    void openDocumentBrowser();
    closeMobilePortraitActions();
  });
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
  listen(window, "keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) {
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

  const initialToolId = store.getActiveToolId();
  if (initialToolId) {
    sanitizeTransparentStylesForTool(initialToolId);
  }
  syncToolbarUi();
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
