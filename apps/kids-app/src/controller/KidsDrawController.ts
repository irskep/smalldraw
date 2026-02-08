import {
  ClearCanvas,
  type DrawingDocumentSize,
  type DrawingStore,
  getTopZIndex,
  type SmalldrawCore,
} from "@smalldraw/core";
import { Vec2 } from "@smalldraw/geometry";
import {
  applyResponsiveLayout,
  normalizePixelRatio,
} from "../layout/responsiveLayout";
import { createKidsDrawPerfSession } from "../perf/kidsDrawPerf";
import type { RasterPipeline } from "../render/createRasterPipeline";
import {
  setNewDrawingPending,
  setToolbarStrokeUi,
  syncToolbarUiFromDrawingStore,
} from "../ui/stores/toolbarUiStore";
import type { KidsDrawToolbar } from "../view/KidsDrawToolbar";
import type { KidsDrawStage } from "../view/KidsDrawStage";

const RESIZE_BAKE_DEBOUNCE_MS = 120;

type RafRenderState = "idle" | "modelRequested" | "anticipatory";

export interface KidsDrawController {
  destroy(): void;
}

export function createKidsDrawController(options: {
  store: DrawingStore;
  core: SmalldrawCore;
  toolbar: KidsDrawToolbar;
  stage: KidsDrawStage;
  pipeline: RasterPipeline;
  backgroundColor: string;
  hasExplicitSize: boolean;
  providedCore: boolean;
  resolvePageSize: () => { width: number; height: number };
  getExplicitSize: () => DrawingDocumentSize;
  getSize: () => { width: number; height: number };
  setSize: (size: { width: number; height: number }) => void;
}): KidsDrawController {
  const {
    store,
    core,
    toolbar,
    stage,
    pipeline,
    backgroundColor,
    hasExplicitSize,
    providedCore,
    resolvePageSize,
    getExplicitSize,
    getSize,
    setSize,
  } = options;

  const perfSession = createKidsDrawPerfSession();
  const disposers: Array<() => void> = [];

  let pointerIsDown = false;
  let drawingPerfFrameCount = 0;
  let rafRenderState: RafRenderState = "idle";
  let rafHandle: number | null = null;
  let layoutRafHandle: number | null = null;
  let debouncedResizeBakeHandle: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  let newDrawingRequestId = 0;
  let clearCounter = 0;
  let displayScale = 1;
  let displayWidth = getSize().width;
  let displayHeight = getSize().height;
  let tilePixelRatio = normalizePixelRatio(
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
  );
  let currentRenderIdentity = "";
  let unsubscribeCoreAdapter: (() => void) | null = null;

  const debugLifecycle = (...args: unknown[]): void => {
    if (!(globalThis as { __kidsDrawDebugLifecycle?: boolean }).__kidsDrawDebugLifecycle) {
      return;
    }
    console.debug("[kids-draw:lifecycle]", ...args);
  };

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
    syncToolbarUiFromDrawingStore(store);
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
    });
    displayScale = updated.displayScale;
    displayWidth = updated.displayWidth;
    displayHeight = updated.displayHeight;
    scheduleResizeBake();
    requestRenderFromModel();
  };

  const applyLayoutAndPixelRatio = (): void => {
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
    const size = getSize();
    const rect = stage.overlay.getBoundingClientRect();
    const widthScale = rect.width > 0 ? size.width / rect.width : 1;
    const heightScale = rect.height > 0 ? size.height / rect.height : 1;
    return new Vec2(event.clientX, event.clientY)
      .sub([rect.left, rect.top])
      .mul([widthScale, heightScale]);
  };

  const subscribeToCoreAdapter = () => {
    unsubscribeCoreAdapter?.();
    unsubscribeCoreAdapter = core.storeAdapter.subscribe((doc) => {
      store.applyDocument(doc);
      syncToolbarUi();
    });
  };

  const runAndSync = (fn: () => void): (() => void) => {
    return () => {
      fn();
      syncToolbarUi();
    };
  };

  const onNewDrawingClick = async () => {
    const requestId = ++newDrawingRequestId;
    debugLifecycle("new-drawing:start", { requestId, destroyed });
    setNewDrawingPending(true);
    try {
      const nextDocumentSize = hasExplicitSize
        ? getExplicitSize()
        : resolvePageSize();
      const adapter = await core.reset({
        documentSize: nextDocumentSize,
      });
      debugLifecycle("new-drawing:reset-resolved", { requestId, destroyed });
      if (destroyed || requestId !== newDrawingRequestId) {
        debugLifecycle("new-drawing:aborted-after-reset", {
          requestId,
          currentRequestId: newDrawingRequestId,
          destroyed,
        });
        return;
      }
      store.resetToDocument(adapter.getDoc());
      applyCanvasSize(nextDocumentSize.width, nextDocumentSize.height);
      subscribeToCoreAdapter();
      pipeline.scheduleBakeForClear();
      pipeline.bakePendingTiles();
      requestRenderFromModel();
      syncToolbarUi();
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

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    pointerIsDown = true;
    drawingPerfFrameCount = 0;
    perfSession.begin();
    store.dispatch("pointerDown", { point: toPoint(event), buttons: event.buttons });
    stage.overlay.setPointerCapture?.(event.pointerId);
    syncToolbarUi();
  };
  const onPointerMove = (event: PointerEvent) => {
    store.dispatch("pointerMove", { point: toPoint(event), buttons: event.buttons });
  };
  const endPointerSession = (event: PointerEvent, type: "pointerUp" | "pointerCancel") => {
    store.dispatch(type, { point: toPoint(event), buttons: event.buttons });
    pointerIsDown = false;
    perfSession.end(drawingPerfFrameCount);
    if (type === "pointerUp") {
      stage.overlay.releasePointerCapture?.(event.pointerId);
    }
    syncToolbarUi();
  };

  const onWindowResize = () => {
    scheduleResponsiveLayout();
  };

  listen(window, "resize", onWindowResize);
  if (window.visualViewport) {
    listen(window.visualViewport, "resize", onWindowResize);
  }
  listen(toolbar.penButton, "click", runAndSync(() => store.activateTool("pen")));
  listen(toolbar.eraserButton, "click", runAndSync(() => store.activateTool("eraser")));
  listen(toolbar.undoButton, "click", runAndSync(() => store.undo()));
  listen(toolbar.redoButton, "click", runAndSync(() => store.redo()));
  listen(
    toolbar.clearButton,
    "click",
    runAndSync(() => {
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
    }),
  );
  listen(toolbar.newDrawingButton, "click", () => {
    void onNewDrawingClick();
  });
  listen(toolbar.colorInput, "input", () => {
    store.updateSharedSettings({ strokeColor: toolbar.colorInput.value });
    setToolbarStrokeUi(toolbar.colorInput.value, Number(toolbar.sizeInput.value));
  });
  listen(toolbar.sizeInput, "input", () => {
    store.updateSharedSettings({ strokeWidth: Number(toolbar.sizeInput.value) });
    setToolbarStrokeUi(toolbar.colorInput.value, Number(toolbar.sizeInput.value));
  });
  listen(stage.overlay, "pointerdown", onPointerDown);
  listen(stage.overlay, "pointermove", onPointerMove);
  listen(stage.overlay, "pointerup", (event) => {
    endPointerSession(event, "pointerUp");
  });
  listen(stage.overlay, "pointercancel", (event) => {
    endPointerSession(event, "pointerCancel");
  });
  listen(stage.overlay, "pointerleave", (event) => {
    endPointerSession(event, "pointerCancel");
  });

  store.setOnRenderNeeded(() => {
    perfSession.onModelInvalidation();
    requestRenderFromModel();
  });

  syncToolbarUi();
  subscribeToCoreAdapter();
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

      pipeline.dispose();
      if (!providedCore) {
        core.destroy();
      }
    },
  };
}
