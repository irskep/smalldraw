import {
  ClearCanvas,
  DrawingStore,
  createSmalldraw,
  getTopZIndex,
  type SmalldrawCore,
  createEraserTool,
  createPenTool,
} from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import {
  HotLayer,
  RasterSession,
  TILE_SIZE,
  TileRenderer,
  createDomLayerController,
  createDomTileProvider,
} from "@smalldraw/renderer-raster";
import { el, mount, unmount } from "redom";

export interface KidsDrawAppOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  backgroundColor?: string;
  core?: SmalldrawCore;
}

export interface KidsDrawApp {
  readonly element: HTMLElement;
  readonly store: DrawingStore;
  readonly overlay: HTMLElement;
  readonly core: SmalldrawCore;
  destroy(): void;
}

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 600;
const KIDS_DRAW_STROKE_WIDTH_MULTIPLIER = 3;
const DESKTOP_INSET_X = 24;
const MOBILE_INSET_Y = 16;
const MOBILE_PORTRAIT_BREAKPOINT = 700;
const RESIZE_BAKE_DEBOUNCE_MS = 120;
const nowMs = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const safeAreaInset = (
  side: "top" | "right" | "bottom" | "left",
  fallbackPx: number,
): string => `max(${fallbackPx}px, env(safe-area-inset-${side}))`;

const normalizePixelRatio = (value: number | undefined): number => {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return value;
};

interface KidsDrawPerfConfig {
  skipSessionRender?: boolean;
  skipHotLayerRender?: boolean;
  skipTileBakeScheduling?: boolean;
  skipTileBakeExecution?: boolean;
  skipSnapshotCapture?: boolean;
}

interface KidsDrawPerfStrokeSummary {
  fps: number;
  frames: number;
  durationMs: number;
  modelInvalidations: number;
  rafFramesExecuted: number;
  renderPasses: number;
  avgRenderPassMs: number;
  sessionRenderMs: number;
  hotLayerMs: number;
  getRenderStateMs: number;
  captureTouchedTilesMs: number;
  bakeMs: number;
  tilesBaked: number;
  snapshotMs: number;
  snapshotCalls: number;
}

interface KidsDrawPerfGlobal {
  config: KidsDrawPerfConfig;
  counters: Record<string, number>;
  timingsMs: Record<string, number>;
  lastStrokeSummary?: KidsDrawPerfStrokeSummary;
  strokeHistory?: KidsDrawPerfStrokeSummary[];
}

const PERF_KEY = "__kidsDrawPerf";

function getKidsDrawPerfGlobal(): KidsDrawPerfGlobal {
  const root = globalThis as Record<string, unknown>;
  const existing = root[PERF_KEY];
  if (existing && typeof existing === "object") {
    const state = existing as KidsDrawPerfGlobal;
    state.config ??= {};
    state.counters ??= {};
    state.timingsMs ??= {};
    state.strokeHistory ??= [];
    return state;
  }
  const created: KidsDrawPerfGlobal = {
    config: {},
    counters: {},
    timingsMs: {},
    strokeHistory: [],
  };
  root[PERF_KEY] = created;
  return created;
}

type RafRenderState =
  | "idle"
  | "modelRequested"
  | "anticipatory";

export async function createKidsDrawApp(
  options: KidsDrawAppOptions,
): Promise<KidsDrawApp> {
  const perfGlobal = getKidsDrawPerfGlobal();
  const providedCore = options.core;
  const core =
    providedCore ??
    (await createSmalldraw({
      persistence: {
        storageKey: "kids-draw-doc-url",
        mode: "reuse",
      },
    }));

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const backgroundColor = options.backgroundColor ?? "#ffffff";

  const element = el("div.kids-draw-app", {
    style: {
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      width: "100%",
      height: "100%",
      "font-family": "system-ui, sans-serif",
      "box-sizing": "border-box",
      border: "2px solid #1f2937",
      background: "#f3f4f6",
    },
  }) as HTMLDivElement;

  const toolbar = el("div.kids-draw-toolbar", {
    style: {
      display: "flex",
      "align-items": "center",
      gap: "8px",
      padding: "6px",
      border: "1px dashed #2563eb",
      background: "#dbeafe",
    },
  }) as HTMLDivElement;

  const penButton = el("button", {
    type: "button",
    textContent: "Pen",
    "data-tool": "pen",
  }) as HTMLButtonElement;
  const eraserButton = el("button", {
    type: "button",
    textContent: "Eraser",
    "data-tool": "eraser",
  }) as HTMLButtonElement;
  const undoButton = el("button", {
    type: "button",
    textContent: "↩️",
    title: "Undo",
    "aria-label": "Undo",
    "data-action": "undo",
  }) as HTMLButtonElement;
  const redoButton = el("button", {
    type: "button",
    textContent: "↪️",
    title: "Redo",
    "aria-label": "Redo",
    "data-action": "redo",
  }) as HTMLButtonElement;
  const clearButton = el("button", {
    type: "button",
    textContent: "Clear",
    title: "Clear canvas",
    "aria-label": "Clear canvas",
    "data-action": "clear",
  }) as HTMLButtonElement;
  const colorInput = el("input", {
    type: "color",
    "data-setting": "color",
  }) as HTMLInputElement;
  const sizeInput = el("input", {
    type: "range",
    min: "1",
    max: "64",
    step: "1",
    "data-setting": "size",
  }) as HTMLInputElement;

  const canvasFrame = el("div.kids-draw-frame", {
    style: {
      position: "relative",
      width: `${width}px`,
      height: `${height}px`,
      overflow: "hidden",
      background: backgroundColor,
      border: "2px solid #0f766e",
      "box-sizing": "border-box",
      "flex-shrink": "0",
    },
  }) as HTMLDivElement;

  const viewportHost = el("div.kids-draw-viewport", {
    style: {
      position: "relative",
      flex: "1 1 auto",
      "min-height": "0",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      overflow: "hidden",
      border: "1px dashed #0891b2",
      background: "#e5e7eb",
      "box-sizing": "border-box",
    },
  }) as HTMLDivElement;

  const sceneRoot = el("div.kids-draw-scene", {
    style: {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${width}px`,
      height: `${height}px`,
      transform: "scale(1)",
      "transform-origin": "top left",
    },
  }) as HTMLDivElement;

  const tileLayer = el("div.kids-draw-layer.kids-draw-tiles", {
    style: {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      outline: "1px dashed #f97316",
      "outline-offset": "-1px",
      "box-sizing": "border-box",
    },
  }) as HTMLDivElement;
  const hotCanvas = el("canvas.kids-draw-layer.kids-draw-hot", {
    style: {
      position: "absolute",
      inset: "0",
      width: `${width}px`,
      height: `${height}px`,
      display: "block",
      "pointer-events": "none",
      outline: "1px dashed #ef4444",
      "outline-offset": "-1px",
    },
  }) as HTMLCanvasElement;
  const overlay = el("div.kids-draw-layer.kids-draw-overlay", {
    style: {
      position: "absolute",
      inset: "0",
      "touch-action": "none",
      cursor: "crosshair",
      outline: "1px dashed #7c3aed",
      "outline-offset": "-1px",
      "box-sizing": "border-box",
    },
  }) as HTMLDivElement;

  mount(toolbar, penButton);
  mount(toolbar, eraserButton);
  mount(toolbar, undoButton);
  mount(toolbar, redoButton);
  mount(toolbar, clearButton);
  mount(toolbar, colorInput);
  mount(toolbar, sizeInput);
  mount(sceneRoot, tileLayer);
  mount(sceneRoot, hotCanvas);
  mount(sceneRoot, overlay);
  mount(canvasFrame, sceneRoot);
  mount(element, toolbar);
  mount(element, viewportHost);
  mount(viewportHost, canvasFrame);
  mount(options.container, element);

  const store = new DrawingStore({
    tools: [createPenTool(), createEraserTool()],
    document: core.storeAdapter.getDoc(),
    actionDispatcher: (event) => core.storeAdapter.applyAction(event),
  });
  store.activateTool("pen");
  const setToolButtonSelected = (
    button: HTMLButtonElement,
    selected: boolean,
  ): void => {
    button.style.border = selected ? "2px solid #111827" : "1px solid #9ca3af";
    button.style.background = selected ? "#93c5fd" : "#ffffff";
    button.style.fontWeight = selected ? "700" : "400";
  };
  const syncToolButtons = () => {
    const active = store.getActiveToolId();
    const penSelected = active === "pen";
    const eraserSelected = active === "eraser";
    penButton.setAttribute("aria-pressed", penSelected ? "true" : "false");
    eraserButton.setAttribute("aria-pressed", eraserSelected ? "true" : "false");
    setToolButtonSelected(penButton, penSelected);
    setToolButtonSelected(eraserButton, eraserSelected);
    undoButton.disabled = !store.canUndo();
    redoButton.disabled = !store.canRedo();
  };
  const shared = store.getSharedSettings();
  const defaultStrokeWidth = Math.max(
    1,
    Math.round(shared.strokeWidth * KIDS_DRAW_STROKE_WIDTH_MULTIPLIER),
  );
  store.updateSharedSettings({ strokeWidth: defaultStrokeWidth });
  let clearCounter = 0;
  let pointerIsDown = false;
  let drawingPerfStartMs: number | null = null;
  let drawingPerfFrameCount = 0;
  let drawingPerfModelInvalidations = 0;
  let drawingPerfRafFramesExecuted = 0;
  let drawingPerfRenderPasses = 0;
  let drawingPerfRenderPassMsTotal = 0;
  let drawingPerfCounterBaseline: Record<string, number> = {};
  let drawingPerfTimingBaseline: Record<string, number> = {};
  let rafRenderState: RafRenderState = "idle";
  let rafHandle: number | null = null;
  const beginDrawingPerf = (): void => {
    drawingPerfStartMs = nowMs();
    drawingPerfFrameCount = 0;
    drawingPerfModelInvalidations = 0;
    drawingPerfRafFramesExecuted = 0;
    drawingPerfRenderPasses = 0;
    drawingPerfRenderPassMsTotal = 0;
    drawingPerfCounterBaseline = { ...perfGlobal.counters };
    drawingPerfTimingBaseline = { ...perfGlobal.timingsMs };
  };
  const recordDrawingFrame = (): void => {
    if (!pointerIsDown || drawingPerfStartMs === null) return;
    drawingPerfFrameCount += 1;
  };
  const endDrawingPerf = (): void => {
    if (drawingPerfStartMs === null) return;
    const durationMs = Math.max(1, nowMs() - drawingPerfStartMs);
    const fps = (drawingPerfFrameCount * 1000) / durationMs;
    const counters = perfGlobal.counters;
    const timings = perfGlobal.timingsMs;
    const readCounterDelta = (key: string): number =>
      (counters[key] ?? 0) - (drawingPerfCounterBaseline[key] ?? 0);
    const readTimingDelta = (key: string): number =>
      (timings[key] ?? 0) - (drawingPerfTimingBaseline[key] ?? 0);
    const renderPasses = Math.max(1, drawingPerfRenderPasses);
    const summary: KidsDrawPerfStrokeSummary = {
      fps,
      frames: drawingPerfFrameCount,
      durationMs,
      modelInvalidations: drawingPerfModelInvalidations,
      rafFramesExecuted: drawingPerfRafFramesExecuted,
      renderPasses: drawingPerfRenderPasses,
      avgRenderPassMs: drawingPerfRenderPassMsTotal / renderPasses,
      sessionRenderMs: readTimingDelta("session.render.ms"),
      hotLayerMs: readTimingDelta("session.hotLayer.renderDrafts.ms"),
      getRenderStateMs: readTimingDelta("session.store.getRenderState.ms"),
      captureTouchedTilesMs: readTimingDelta("session.captureTouchedTiles.ms"),
      bakeMs: readTimingDelta("tileRenderer.bakePendingTiles.ms"),
      tilesBaked: readCounterDelta("tileRenderer.bakePendingTiles.tilesBaked"),
      snapshotMs: readTimingDelta("tileRenderer.captureViewportSnapshot.ms"),
      snapshotCalls: readCounterDelta("tileRenderer.captureViewportSnapshot.calls"),
    };
    perfGlobal.lastStrokeSummary = summary;
    perfGlobal.strokeHistory?.push(summary);
    console.log(
      `[kids-draw] stroke avg fps: ${fps.toFixed(1)} (${drawingPerfFrameCount} frames / ${durationMs.toFixed(1)}ms); model=${summary.modelInvalidations}; raf=${summary.rafFramesExecuted}; renderPass=${summary.renderPasses}; renderMs=${summary.avgRenderPassMs.toFixed(2)}; bakeTiles=${summary.tilesBaked}; bakeMs=${summary.bakeMs.toFixed(1)}; snapshotCalls=${summary.snapshotCalls}`,
    );
    drawingPerfStartMs = null;
    drawingPerfFrameCount = 0;
  };
  colorInput.value = shared.strokeColor;
  sizeInput.value = `${defaultStrokeWidth}`;
  syncToolButtons();

  const scheduleAnimationFrame = (callback: FrameRequestCallback): number => {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(callback);
    }
    return setTimeout(() => callback(nowMs()), 16) as unknown as number;
  };
  const cancelAnimationFrameHandle = (handle: number): void => {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle);
  };
  let displayScale = 1;
  let displayWidth = width;
  let displayHeight = height;
  let tilePixelRatio = normalizePixelRatio(
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
  );
  let currentRenderIdentity = "";
  let layoutRafHandle: number | null = null;
  let debouncedResizeBakeHandle: ReturnType<typeof setTimeout> | null = null;
  const getRenderIdentity = (): string =>
    [
      "kids-draw",
      `w:${width}`,
      `h:${height}`,
      `tile:${TILE_SIZE}`,
      `dpr:${tilePixelRatio.toFixed(3)}`,
      `bg:${backgroundColor}`,
    ].join("|");

  const tileProvider = createDomTileProvider(tileLayer, {
    getPixelRatio: () => tilePixelRatio,
    getTileIdentity: () => currentRenderIdentity,
  });

  const tileRenderer = new TileRenderer(store, tileProvider, {
    backgroundColor,
    renderIdentity: "kids-draw-init",
    baker: {
      bakeTile: async (coord, canvas) => {
        const expectedTilePixels = Math.max(
          1,
          Math.round(TILE_SIZE * tilePixelRatio),
        );
        if (canvas.width !== expectedTilePixels) {
          canvas.width = expectedTilePixels;
        }
        if (canvas.height !== expectedTilePixels) {
          canvas.height = expectedTilePixels;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const tileScaleX = canvas.width / TILE_SIZE;
        const tileScaleY = canvas.height / TILE_SIZE;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.setTransform(tileScaleX, 0, 0, tileScaleY, 0, 0);
        ctx.translate(-coord.x * TILE_SIZE, -coord.y * TILE_SIZE);
        tileRenderer.renderShapes(ctx, store.getOrderedShapes());
        ctx.restore();
      },
    },
  });
  currentRenderIdentity = getRenderIdentity();
  tileRenderer.setRenderIdentity(currentRenderIdentity);
  tileRenderer.updateViewport({
    min: [0, 0],
    max: [width, height],
  });

  const hotLayer = new HotLayer(hotCanvas, {
    backgroundColor: undefined,
  });
  const layerController = createDomLayerController(tileLayer, hotCanvas);
  hotLayer.setViewport({
    width,
    height,
    center: new Vec2(width / 2, height / 2),
    scale: 1,
  });

  const sessionWithSnapshot = new RasterSession(store, tileRenderer, hotLayer, {
    layerController,
  });
  const hotCtx = hotCanvas.getContext("2d");
  if (!hotCtx) {
    throw new Error("kids-app hot canvas requires a 2D context");
  }
  const applyHotCanvasPixelRatio = (pixelRatio: number): void => {
    const nextWidth = Math.max(1, Math.round(width * pixelRatio));
    const nextHeight = Math.max(1, Math.round(height * pixelRatio));
    if (hotCanvas.width !== nextWidth) {
      hotCanvas.width = nextWidth;
    }
    if (hotCanvas.height !== nextHeight) {
      hotCanvas.height = nextHeight;
    }
    hotCtx.setTransform(1, 0, 0, 1, 0, 0);
    hotCtx.clearRect(0, 0, hotCanvas.width, hotCanvas.height);
  };
  const renderPass = (): void => {
    const passStartMs = nowMs();
    drawingPerfRenderPasses += 1;
    recordDrawingFrame();
    syncToolButtons();
    sessionWithSnapshot.render();
    drawingPerfRenderPassMsTotal += nowMs() - passStartMs;
  };
  const ensureRafScheduled = (): void => {
    if (rafHandle !== null) return;
    rafHandle = scheduleAnimationFrame(() => {
      rafHandle = null;
      drawingPerfRafFramesExecuted += 1;
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
  store.setOnRenderNeeded(() => {
    drawingPerfModelInvalidations += 1;
    requestRenderFromModel();
  });
  const unsubscribe = core.storeAdapter.subscribe((doc) => {
    store.applyDocument(doc);
    syncToolButtons();
  });
  requestRenderFromModel();
  const initialShapes = Object.values(store.getDocument().shapes);
  if (initialShapes.length) {
    for (const shape of initialShapes) {
      tileRenderer.updateTouchedTilesForShape(shape);
    }
    tileRenderer.scheduleBakeForShapes(initialShapes.map((shape) => shape.id));
    void tileRenderer.bakePendingTiles();
  }

  const computeInsets = (): { x: number; y: number } => {
    const viewportWidth =
      typeof window !== "undefined" && typeof window.innerWidth === "number"
        ? window.innerWidth
        : width;
    const viewportHeight =
      typeof window !== "undefined" && typeof window.innerHeight === "number"
        ? window.innerHeight
        : height;
    const portrait = viewportHeight > viewportWidth;
    const isNarrowPortrait =
      portrait && viewportWidth <= MOBILE_PORTRAIT_BREAKPOINT;
    return {
      x: isNarrowPortrait ? 0 : DESKTOP_INSET_X,
      y: MOBILE_INSET_Y,
    };
  };

  const scheduleResizeBake = (): void => {
    if (debouncedResizeBakeHandle !== null) {
      clearTimeout(debouncedResizeBakeHandle);
    }
    debouncedResizeBakeHandle = setTimeout(() => {
      debouncedResizeBakeHandle = null;
      tileRenderer.scheduleBakeForClear();
      void tileRenderer.bakePendingTiles();
      requestRenderFromModel();
    }, RESIZE_BAKE_DEBOUNCE_MS);
  };

  const applyResponsiveLayout = (): void => {
    const hostRect = viewportHost.getBoundingClientRect();
    if (hostRect.width <= 0 || hostRect.height <= 0) {
      return;
    }
    const insets = computeInsets();
    viewportHost.style.paddingTop = safeAreaInset("top", insets.y);
    viewportHost.style.paddingRight = safeAreaInset("right", insets.x);
    viewportHost.style.paddingBottom = safeAreaInset("bottom", insets.y);
    viewportHost.style.paddingLeft = safeAreaInset("left", insets.x);

    const availableWidth = Math.max(1, hostRect.width - insets.x * 2);
    const availableHeight = Math.max(1, hostRect.height - insets.y * 2);
    const nextScale = Math.min(1, availableWidth / width, availableHeight / height);

    if (nextScale !== displayScale) {
      displayScale = nextScale;
      displayWidth = Math.max(1, Math.round(width * displayScale));
      displayHeight = Math.max(1, Math.round(height * displayScale));
      canvasFrame.style.width = `${displayWidth}px`;
      canvasFrame.style.height = `${displayHeight}px`;
      sceneRoot.style.transform = `scale(${displayScale})`;
    }

    const nextPixelRatio = normalizePixelRatio(
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    );
    if (nextPixelRatio !== tilePixelRatio) {
      tilePixelRatio = nextPixelRatio;
      applyHotCanvasPixelRatio(tilePixelRatio);
      const nextIdentity = getRenderIdentity();
      if (nextIdentity !== currentRenderIdentity) {
        currentRenderIdentity = nextIdentity;
        tileRenderer.setRenderIdentity(currentRenderIdentity);
      }
      scheduleResizeBake();
    }
  };

  const scheduleResponsiveLayout = (): void => {
    if (layoutRafHandle !== null) {
      return;
    }
    layoutRafHandle = scheduleAnimationFrame(() => {
      layoutRafHandle = null;
      applyResponsiveLayout();
    });
  };

  applyHotCanvasPixelRatio(tilePixelRatio);
  applyResponsiveLayout();
  scheduleResizeBake();

  const onWindowResize = () => {
    scheduleResponsiveLayout();
  };
  window.addEventListener("resize", onWindowResize);
  window.visualViewport?.addEventListener("resize", onWindowResize);

  penButton.addEventListener("click", () => {
    store.activateTool("pen");
    syncToolButtons();
  });
  eraserButton.addEventListener("click", () => {
    store.activateTool("eraser");
    syncToolButtons();
  });
  undoButton.addEventListener("click", () => {
    store.undo();
    syncToolButtons();
  });
  redoButton.addEventListener("click", () => {
    store.redo();
    syncToolButtons();
  });
  clearButton.addEventListener("click", () => {
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
    syncToolButtons();
  });
  colorInput.addEventListener("input", () => {
    store.updateSharedSettings({ strokeColor: colorInput.value });
  });
  sizeInput.addEventListener("input", () => {
    store.updateSharedSettings({ strokeWidth: Number(sizeInput.value) });
  });

  const toPoint = (event: PointerEvent): Vec2 => {
    const rect = overlay.getBoundingClientRect();
    const widthScale = rect.width > 0 ? width / rect.width : 1;
    const heightScale = rect.height > 0 ? height / rect.height : 1;
    return new Vec2(event.clientX, event.clientY)
      .sub([rect.left, rect.top])
      .mul([widthScale, heightScale]);
  };
  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    pointerIsDown = true;
    beginDrawingPerf();
    store.dispatch("pointerDown", { point: toPoint(event), buttons: event.buttons });
    overlay.setPointerCapture?.(event.pointerId);
    syncToolButtons();
  };
  const onPointerMove = (event: PointerEvent) => {
    store.dispatch("pointerMove", { point: toPoint(event), buttons: event.buttons });
  };
  const onPointerUp = (event: PointerEvent) => {
    store.dispatch("pointerUp", { point: toPoint(event), buttons: event.buttons });
    pointerIsDown = false;
    endDrawingPerf();
    overlay.releasePointerCapture?.(event.pointerId);
    syncToolButtons();
  };
  const onPointerCancel = (event: PointerEvent) => {
    store.dispatch("pointerCancel", {
      point: toPoint(event),
      buttons: event.buttons,
    });
    pointerIsDown = false;
    endDrawingPerf();
    syncToolButtons();
  };
  overlay.addEventListener("pointerdown", onPointerDown);
  overlay.addEventListener("pointermove", onPointerMove);
  overlay.addEventListener("pointerup", onPointerUp);
  overlay.addEventListener("pointercancel", onPointerCancel);
  overlay.addEventListener("pointerleave", onPointerCancel);

  return {
    element,
    store,
    overlay,
    core,
    destroy() {
      store.setOnRenderNeeded(undefined);
      unsubscribe();
      window.removeEventListener("resize", onWindowResize);
      window.visualViewport?.removeEventListener("resize", onWindowResize);
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
      overlay.removeEventListener("pointerdown", onPointerDown);
      overlay.removeEventListener("pointermove", onPointerMove);
      overlay.removeEventListener("pointerup", onPointerUp);
      overlay.removeEventListener("pointercancel", onPointerCancel);
      overlay.removeEventListener("pointerleave", onPointerCancel);
      tileRenderer.dispose();
      layerController.setMode("tiles");
      hotLayer.clear();
      hotLayer.setBackdrop(null);
      unmount(options.container, element);
      if (!providedCore) {
        core.destroy();
      }
    },
  };
}
