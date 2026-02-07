import {
  AddShape,
  ClearCanvas,
  DrawingStore,
  getPenStrokeOutline,
  createSmalldraw,
  getTopZIndex,
  getZIndexBetween,
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
const nowMs = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

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

type LiveTool = "pen" | "eraser";

interface LiveStrokeState {
  tool: LiveTool;
  stroke: {
    type: "brush";
    color: string;
    size: number;
    compositeOp: "source-over" | "destination-out";
  };
  points: Array<[number, number]>;
  renderedPointCount: number;
  backdrop: HTMLCanvasElement | null;
  rafId: number | null;
}

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
      width: `${width}px`,
      "font-family": "system-ui, sans-serif",
      padding: "8px",
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
  mount(canvasFrame, tileLayer);
  mount(canvasFrame, hotCanvas);
  mount(canvasFrame, overlay);
  mount(element, toolbar);
  mount(element, canvasFrame);
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

  const tileRenderer = new TileRenderer(store, createDomTileProvider(tileLayer), {
    backgroundColor,
    baker: {
      bakeTile: async (coord, canvas) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-coord.x * TILE_SIZE, -coord.y * TILE_SIZE);
        tileRenderer.renderShapes(ctx, store.getOrderedShapes());
        ctx.restore();
      },
    },
  });
  tileRenderer.updateViewport({
    min: [0, 0],
    max: [width, height],
  });

  const hotLayer = new HotLayer(hotCanvas, {
    backgroundColor: undefined,
  });
  hotLayer.setViewport({
    width,
    height,
    center: new Vec2(width / 2, height / 2),
    scale: 1,
  });

  const sessionWithSnapshot = new RasterSession(store, tileRenderer, hotLayer);
  const hotCtx = hotCanvas.getContext("2d");
  if (!hotCtx) {
    throw new Error("kids-app hot canvas requires a 2D context");
  }
  let liveStrokeState: LiveStrokeState | null = null;
  let liveStrokeCounter = 0;
  const clearHotCanvas = () => {
    hotCtx.setTransform(1, 0, 0, 1, 0, 0);
    hotCtx.clearRect(0, 0, hotCanvas.width, hotCanvas.height);
  };
  const captureTileLayerSnapshot = (): HTMLCanvasElement => {
    const snapshot = document.createElement("canvas");
    snapshot.width = width;
    snapshot.height = height;
    const ctx = snapshot.getContext("2d");
    if (!ctx) {
      return snapshot;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    const tileCanvases = tileLayer.querySelectorAll("canvas");
    for (const tileCanvas of tileCanvases) {
      const left = Number.parseFloat(tileCanvas.style.left || "0") || 0;
      const top = Number.parseFloat(tileCanvas.style.top || "0") || 0;
      if (typeof (ctx as CanvasRenderingContext2D).drawImage === "function") {
        ctx.drawImage(tileCanvas, left, top);
      }
    }
    return snapshot;
  };
  const createStrokeShapeFromPoints = (state: LiveStrokeState) => {
    const points = state.points;
    const firstPoint = points[0];
    if (!firstPoint) {
      return null;
    }
    let minX = firstPoint[0];
    let minY = firstPoint[1];
    let maxX = firstPoint[0];
    let maxY = firstPoint[1];
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const localPoints = points.map(
      ([x, y]) => [x - centerX, y - centerY] as [number, number],
    );
    return {
      id: "live-stroke",
      type: "pen" as const,
      geometry: {
        type: "pen" as const,
        points: localPoints,
      },
      style: {
        stroke: state.stroke,
      },
      zIndex: "live-stroke",
      layerId: "default",
      transform: {
        translation: [centerX, centerY] as [number, number],
        scale: [1, 1] as [number, number],
        rotation: 0,
      },
    };
  };
  const renderLiveStroke = (state: LiveStrokeState): void => {
    clearHotCanvas();
    if (state.backdrop) {
      hotCtx.drawImage(state.backdrop, 0, 0);
    }
    const shape = createStrokeShapeFromPoints(state);
    if (!shape) {
      return;
    }
    const outline = getPenStrokeOutline(shape);
    if (!outline.length) {
      return;
    }
    const [first, ...rest] = outline;
    if (!first) {
      return;
    }
    const drawableCtx = hotCtx as unknown as {
      save?: () => void;
      restore?: () => void;
      translate?: (x: number, y: number) => void;
      beginPath?: () => void;
      moveTo?: (x: number, y: number) => void;
      lineTo?: (x: number, y: number) => void;
      closePath?: () => void;
      fill?: () => void;
      globalCompositeOperation?: string;
      fillStyle?: string | CanvasGradient | CanvasPattern;
    };
    if (
      typeof drawableCtx.save !== "function" ||
      typeof drawableCtx.restore !== "function" ||
      typeof drawableCtx.translate !== "function" ||
      typeof drawableCtx.beginPath !== "function" ||
      typeof drawableCtx.moveTo !== "function" ||
      typeof drawableCtx.lineTo !== "function" ||
      typeof drawableCtx.closePath !== "function" ||
      typeof drawableCtx.fill !== "function"
    ) {
      return;
    }
    drawableCtx.save();
    drawableCtx.translate(
      shape.transform.translation[0],
      shape.transform.translation[1],
    );
    drawableCtx.globalCompositeOperation = state.stroke.compositeOp;
    drawableCtx.fillStyle = state.stroke.color;
    drawableCtx.beginPath();
    drawableCtx.moveTo(first[0], first[1]);
    for (const [x, y] of rest) {
      drawableCtx.lineTo(x, y);
    }
    drawableCtx.closePath();
    drawableCtx.fill();
    drawableCtx.restore();
  };
  const pumpLiveStroke = () => {
    const state = liveStrokeState;
    if (!state) return;
    if (state.renderedPointCount !== state.points.length) {
      renderLiveStroke(state);
      state.renderedPointCount = state.points.length;
    }
    recordDrawingFrame();
    state.rafId = scheduleAnimationFrame(() => {
      pumpLiveStroke();
    });
  };
  const toPointTuple = (point: Vec2): [number, number] => [point[0], point[1]];
  const buildCommittedStrokeShape = (state: LiveStrokeState) => {
    const shape = createStrokeShapeFromPoints(state);
    if (!shape) {
      throw new Error("Cannot commit an empty live stroke");
    }
    const currentTop = getTopZIndex(store.getDocument());
    return {
      id: `${state.tool}-${Date.now()}-${liveStrokeCounter++}`,
      type: shape.type,
      geometry: shape.geometry,
      style: shape.style,
      zIndex: getZIndexBetween(currentTop, null),
      layerId: "default",
      interactions: {
        resizable: true,
        rotatable: false,
      },
      transform: shape.transform,
    };
  };
  const startLiveStroke = (tool: LiveTool, point: Vec2) => {
    const sharedSettings = store.getSharedSettings();
    const stroke = {
      type: "brush" as const,
      color: sharedSettings.strokeColor,
      size: sharedSettings.strokeWidth,
      compositeOp:
        tool === "eraser"
          ? ("destination-out" as const)
          : ("source-over" as const),
    };
    const backdrop = tool === "eraser" ? captureTileLayerSnapshot() : null;
    if (tool === "eraser") {
      tileLayer.style.visibility = "hidden";
    }
    clearHotCanvas();
    if (backdrop) {
      const drawableCtx = hotCtx as unknown as {
        drawImage?: (image: CanvasImageSource, x: number, y: number) => void;
      };
      drawableCtx.drawImage?.(backdrop, 0, 0);
    }
    const state: LiveStrokeState = {
      tool,
      stroke,
      points: [toPointTuple(point)],
      renderedPointCount: 0,
      backdrop,
      rafId: null,
    };
    liveStrokeState = state;
    pumpLiveStroke();
  };
  const appendLiveStrokePoint = (point: Vec2) => {
    if (!liveStrokeState) return;
    liveStrokeState.points.push(toPointTuple(point));
  };
  const finishLiveStroke = () => {
    const state = liveStrokeState;
    if (!state) {
      clearHotCanvas();
      return;
    }
    if (state.rafId !== null) {
      cancelAnimationFrameHandle(state.rafId);
      state.rafId = null;
    }
    if (state.points.length >= 2) {
      store.applyAction(new AddShape(buildCommittedStrokeShape(state)));
    }
    if (state.tool === "eraser") {
      tileLayer.style.visibility = "";
    }
    liveStrokeState = null;
    clearHotCanvas();
  };
  const renderPass = (): void => {
    const passStartMs = nowMs();
    drawingPerfRenderPasses += 1;
    recordDrawingFrame();
    syncToolButtons();
    if (liveStrokeState) {
      drawingPerfRenderPassMsTotal += nowMs() - passStartMs;
      return;
    }
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
    return new Vec2(event.clientX, event.clientY)
      .sub([rect.left, rect.top])
      .div([1, 1]);
  };
  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    pointerIsDown = true;
    beginDrawingPerf();
    const tool = store.getActiveToolId();
    if (tool === "pen" || tool === "eraser") {
      startLiveStroke(tool, toPoint(event));
    }
    overlay.setPointerCapture?.(event.pointerId);
    syncToolButtons();
  };
  const onPointerMove = (event: PointerEvent) => {
    appendLiveStrokePoint(toPoint(event));
    syncToolButtons();
  };
  const onPointerUp = (event: PointerEvent) => {
    appendLiveStrokePoint(toPoint(event));
    finishLiveStroke();
    pointerIsDown = false;
    endDrawingPerf();
    overlay.releasePointerCapture?.(event.pointerId);
    syncToolButtons();
  };
  const onPointerCancel = (_event: PointerEvent) => {
    finishLiveStroke();
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
      const strokeStateAtDestroy = liveStrokeState;
      if (strokeStateAtDestroy && strokeStateAtDestroy.rafId !== null) {
        cancelAnimationFrameHandle(strokeStateAtDestroy.rafId);
      }
      tileLayer.style.visibility = "";
      liveStrokeState = null;
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
      hotLayer.clear();
      hotLayer.setBackdrop(null);
      unmount(options.container, element);
      if (!providedCore) {
        core.destroy();
      }
    },
  };
}
