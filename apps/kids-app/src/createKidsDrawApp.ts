import {
  ClearCanvas,
  DrawingStore,
  createSmalldraw,
  getTopZIndex,
  type SmalldrawCore,
  type ToolPointerEvent,
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

type RafRenderState =
  | "idle"
  | "modelRequested"
  | "anticipatory";

export async function createKidsDrawApp(
  options: KidsDrawAppOptions,
): Promise<KidsDrawApp> {
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
  let rafRenderState: RafRenderState = "idle";
  let rafHandle: number | null = null;
  const beginDrawingPerf = (): void => {
    drawingPerfStartMs = nowMs();
    drawingPerfFrameCount = 0;
  };
  const recordDrawingFrame = (): void => {
    if (!pointerIsDown || drawingPerfStartMs === null) return;
    drawingPerfFrameCount += 1;
  };
  const endDrawingPerf = (): void => {
    if (drawingPerfStartMs === null) return;
    const durationMs = Math.max(1, nowMs() - drawingPerfStartMs);
    const fps = (drawingPerfFrameCount * 1000) / durationMs;
    console.log(
      `[kids-draw] stroke avg fps: ${fps.toFixed(1)} (${drawingPerfFrameCount} frames / ${durationMs.toFixed(1)}ms)`,
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
  const renderPass = (): void => {
    recordDrawingFrame();
    syncToolButtons();
    sessionWithSnapshot.render();
  };
  const ensureRafScheduled = (): void => {
    if (rafHandle !== null) return;
    rafHandle = scheduleAnimationFrame(() => {
      rafHandle = null;
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
  const toPayload = (
    event: PointerEvent,
    buttonsOverride?: number,
  ): ToolPointerEvent => {
    const resolvedButtons =
      buttonsOverride ??
      (event.buttons > 0
        ? event.buttons
        : pointerIsDown &&
            (event.type === "pointerdown" || event.type === "pointermove")
          ? 1
          : 0);
    return {
      point: toPoint(event),
      buttons: resolvedButtons,
      pressure: typeof event.pressure === "number" ? event.pressure : undefined,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    };
  };
  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    pointerIsDown = true;
    beginDrawingPerf();
    overlay.setPointerCapture?.(event.pointerId);
    store.dispatch("pointerDown", toPayload(event));
    syncToolButtons();
  };
  const onPointerMove = (event: PointerEvent) => {
    store.dispatch("pointerMove", toPayload(event));
    syncToolButtons();
  };
  const onPointerUp = (event: PointerEvent) => {
    store.dispatch("pointerUp", toPayload(event, 0));
    pointerIsDown = false;
    endDrawingPerf();
    overlay.releasePointerCapture?.(event.pointerId);
    syncToolButtons();
  };
  const onPointerCancel = (event: PointerEvent) => {
    store.dispatch("pointerCancel", toPayload(event, 0));
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
