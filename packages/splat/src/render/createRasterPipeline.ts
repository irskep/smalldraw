import type { AnyShape, DrawingLayer, DrawingStore } from "@smalldraw/core";
import { BoxOperations, Vec2 } from "@smalldraw/geometry";
import type { ShapeRendererRegistry } from "@smalldraw/renderer-canvas";
import { createLayerStack, HotLayer } from "@smalldraw/renderer-raster";
import { atom } from "nanostores";
import { logDiagnosticEvent } from "../controller/diagnostics/diagnosticLogger";
import {
  getLoadedRasterImage,
  onDeferredImageLoaded,
} from "../shapes/rasterImageCache";
import type { KidsDrawStage } from "../view/KidsDrawStage";
import { processApplyDocumentDiff } from "./processApplyDocumentDiff";

export interface RasterPipeline {
  render(): void;
  updateDirtyRectOverlay(): void;
  updateViewport(width: number, height: number): void;
  setTilePixelRatio(pixelRatio: number): void;
  getTilePixelRatio(): number;
  setRenderIdentity(renderIdentity: string): void;
  bakeInitialShapes(shapes: AnyShape[]): void;
  setLayers(layers: DrawingLayer[]): void;
  scheduleBakeForClear(): void;
  bakePendingTiles(): void;
  flushBakes(): Promise<void>;
  dispose(): void;
}

export function createRasterPipeline(options: {
  store: DrawingStore;
  stage: KidsDrawStage;
  shapeRendererRegistry: ShapeRendererRegistry;
  width: number;
  height: number;
  backgroundColor: string;
  tilePixelRatio: number;
  renderIdentity: string;
}): RasterPipeline {
  const { store, stage, shapeRendererRegistry, backgroundColor } = options;
  let width = options.width;
  let height = options.height;
  let tilePixelRatio = options.tilePixelRatio;
  let orderedLayers: DrawingLayer[] = [];
  let currentRenderIdentity = options.renderIdentity;
  const draftSession = atom<{
    phase: "idle" | "capturing" | "active" | "ending";
    draftId?: string;
    layerId?: string;
  }>({ phase: "idle" });
  let draftSessionNeedsFullRender = false;
  let completedFrame: { canvas: HTMLCanvasElement; size: Vec2 } | null = null;
  let disposed = false;
  let clearIndexDocument: ReturnType<DrawingStore["getDocument"]> | null = null;
  const knownClearShapeIds = new Set<string>();

  const layerStack = createLayerStack({
    store,
    host: stage.tileLayer,
    hotCanvas: stage.hotCanvas,
    shapeRendererRegistry,
    resolveImage: (src) => getLoadedRasterImage(src) ?? null,
    backgroundColor,
  });

  const hotLayer = new HotLayer(stage.hotCanvas, {
    shapeRendererRegistry,
    backgroundColor: undefined,
  });

  const hotOverlayCtx = stage.hotOverlayCanvas.getContext("2d");
  if (!hotOverlayCtx) {
    throw new Error("splatterboard hot overlay canvas requires a 2D context");
  }

  const applyHotCanvasPixelRatio = (
    previousWidth = width,
    previousHeight = height,
  ): void => {
    const nextWidth = Math.max(1, Math.round(width * tilePixelRatio));
    const nextHeight = Math.max(1, Math.round(height * tilePixelRatio));
    // Once the draft is committed, this frame is the only visible copy until
    // its tiles settle. Resizing clears a canvas, so preserve that frame at
    // its original logical extent (a viewport change must not stretch it).
    if (
      (draftSession.get().phase === "ending" ||
        (draftSession.get().phase === "active" &&
          getActiveLayerDrafts().length === 0)) &&
      (stage.hotCanvas.width !== nextWidth ||
        stage.hotCanvas.height !== nextHeight)
    ) {
      if (!completedFrame) {
        const canvas = document.createElement("canvas");
        canvas.width = stage.hotCanvas.width;
        canvas.height = stage.hotCanvas.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Completed frame requires a 2D context");
        ctx.drawImage(stage.hotCanvas, 0, 0);
        completedFrame = {
          canvas,
          size: new Vec2(previousWidth, previousHeight),
        };
      }
    }
    if (stage.hotCanvas.width !== nextWidth) {
      stage.hotCanvas.width = nextWidth;
    }
    if (stage.hotCanvas.height !== nextHeight) {
      stage.hotCanvas.height = nextHeight;
    }
    if (completedFrame) {
      hotLayer.clear();
      const size = new Vec2(completedFrame.size)
        .mul([nextWidth, nextHeight])
        .div([width, height]);
      stage.hotCanvas
        .getContext("2d")
        ?.drawImage(completedFrame.canvas, 0, 0, size[0], size[1]);
    }
    if (stage.hotOverlayCanvas.width !== nextWidth) {
      stage.hotOverlayCanvas.width = nextWidth;
    }
    if (stage.hotOverlayCanvas.height !== nextHeight) {
      stage.hotOverlayCanvas.height = nextHeight;
    }
    hotOverlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    hotOverlayCtx.clearRect(
      0,
      0,
      stage.hotOverlayCanvas.width,
      stage.hotOverlayCanvas.height,
    );
    stage.hotOverlayCanvas.style.display = "none";
    layerStack.updateViewport(width, height, tilePixelRatio);
    draftSessionNeedsFullRender = true;
    hotLayer.setViewport({
      width,
      height,
      center: new Vec2(width / 2, height / 2),
      scale: 1,
    });
  };

  const getActiveLayerDrafts = () => {
    const activeLayerId = store.getActiveLayerId();
    return store
      .getDrafts()
      .filter((draft) => (draft.layerId ?? "default") === activeLayerId);
  };

  const hasClearMutation = (
    dirtyShapeIds: Iterable<string>,
    deletedShapeIds: Iterable<string>,
  ): boolean => {
    const shapes = store.getDocument().shapes;
    for (const shapeId of dirtyShapeIds) {
      if (shapes[shapeId]?.type === "clear") {
        return true;
      }
    }
    for (const shapeId of deletedShapeIds) {
      if (knownClearShapeIds.has(shapeId)) {
        return true;
      }
    }
    return false;
  };

  const updateKnownClearShapeIds = (): void => {
    const document = store.getDocument();
    if (document === clearIndexDocument) return;
    clearIndexDocument = document;
    knownClearShapeIds.clear();
    for (const [shapeId, shape] of Object.entries(document.shapes)) {
      if (shape.type === "clear") {
        knownClearShapeIds.add(shapeId);
      }
    }
  };

  const endDraftSession = (): void => {
    draftSession.set({ phase: "idle" });
    completedFrame = null;
    hotLayer.clear();
    hotLayer.setDraftComposite(null);
    layerStack.endActiveLayerDraftSession();
    draftSessionNeedsFullRender = false;
    stage.hotCanvas.style.visibility = "hidden";
  };

  const reportRenderError = (error: unknown): void => {
    logDiagnosticEvent(
      "pipeline_render_failed",
      {
        message: error instanceof Error ? error.message : String(error),
      },
      "error",
    );
  };

  const beginDraftSession = (draftId: string): void => {
    const session = {
      phase: "capturing" as const,
      draftId,
      layerId: store.getActiveLayerId(),
    };
    draftSession.set(session);
    void layerStack
      .beginActiveLayerDraftSession()
      .then(() => {
        if (disposed || draftSession.get() !== session) return;
        const composite = layerStack.getActiveLayerDraftComposite();
        if (!composite) {
          endDraftSession();
          return;
        }
        hotLayer.setDraftComposite(composite);
        draftSession.set({ ...session, phase: "active" });
        draftSessionNeedsFullRender = true;
        renderInternal();
      })
      .catch((error) => {
        if (disposed || draftSession.get().draftId !== session.draftId) return;
        endDraftSession();
        reportRenderError(error);
      });
  };

  const finishDraftSession = (): void => {
    const current = draftSession.get();
    if (current.phase === "idle" || current.phase === "ending") return;
    if (current.phase === "capturing") {
      endDraftSession();
      return;
    }
    // Keep the completed stroke visible until its committed tiles are ready.
    const ending = { ...current, phase: "ending" as const };
    draftSession.set(ending);
    void layerStack
      .flushBakes()
      .then(() => {
        if (!disposed && draftSession.get() === ending) endDraftSession();
      })
      .catch((error) => {
        if (disposed || draftSession.get() !== ending) return;
        endDraftSession();
        reportRenderError(error);
      });
  };

  const renderInternal = (): void => {
    if (disposed) return;
    layerStack.setActiveLayer(store.getActiveLayerId());
    const applyDiff = store.consumeApplyDocumentDiff();
    if (applyDiff) {
      processApplyDocumentDiff(applyDiff, layerStack, store.getShapeHandlers());
    }
    const dirtyByLayerState = store.consumeDirtyStateByLayer();
    const dirtyShapeIds = new Set<string>();
    const deletedShapeIds = new Set<string>();
    for (const ids of dirtyByLayerState.dirtyByLayer.values()) {
      for (const shapeId of ids) {
        dirtyShapeIds.add(shapeId);
      }
    }
    for (const ids of dirtyByLayerState.deletedByLayer.values()) {
      for (const shapeId of ids) {
        deletedShapeIds.add(shapeId);
      }
    }
    if (dirtyShapeIds.size > 0 || deletedShapeIds.size > 0) {
      logDiagnosticEvent("pipeline_dirty_consumed", {
        dirtyCount: dirtyShapeIds.size,
        deletedCount: deletedShapeIds.size,
        dirtyLayerCount: dirtyByLayerState.dirtyByLayer.size,
        deletedLayerCount: dirtyByLayerState.deletedByLayer.size,
        activeLayerId: store.getActiveLayerId(),
      });
    }

    if (hasClearMutation(dirtyShapeIds, deletedShapeIds)) {
      logDiagnosticEvent("pipeline_clear_invalidation_scheduled", {
        dirtyCount: dirtyShapeIds.size,
        deletedCount: deletedShapeIds.size,
      });
      layerStack.scheduleFullInvalidation();
    } else {
      layerStack.routeDirtyShapes(dirtyShapeIds, deletedShapeIds);
    }

    const drafts = getActiveLayerDrafts();
    if (drafts.length === 0) {
      finishDraftSession();
      updateKnownClearShapeIds();
      return;
    }

    const session = draftSession.get();
    if (
      session.phase !== "idle" &&
      (session.draftId !== drafts[0].id ||
        session.layerId !== store.getActiveLayerId() ||
        session.phase === "ending")
    ) {
      endDraftSession();
    }
    if (draftSession.get().phase !== "active") {
      if (draftSession.get().phase === "idle") beginDraftSession(drafts[0].id);
      updateKnownClearShapeIds();
      return;
    }

    const preview = store.consumePreview();
    hotLayer.renderDrafts(drafts, {
      dirtyBounds: draftSessionNeedsFullRender
        ? null
        : (preview?.dirtyBounds ?? null),
    });
    draftSessionNeedsFullRender = false;
    stage.hotCanvas.style.visibility = "";
    updateKnownClearShapeIds();
  };

  applyHotCanvasPixelRatio();
  layerStack.setRenderIdentity(currentRenderIdentity);

  const disposeDeferredImageListener = onDeferredImageLoaded(() => {
    logDiagnosticEvent("pipeline_deferred_image_loaded");
    layerStack.scheduleFullInvalidation();
  });

  return {
    render() {
      renderInternal();
    },
    updateDirtyRectOverlay() {
      if (!stage.dirtyRectOverlay || !stage.dirtyRectShape) {
        return;
      }
      const preview = store.getPreview();
      const hasDrafts = getActiveLayerDrafts().length > 0;
      if (!hasDrafts || !preview?.dirtyBounds) {
        stage.dirtyRectOverlay.style.visibility = "hidden";
        return;
      }
      const dirty = new BoxOperations(preview.dirtyBounds);
      stage.dirtyRectShape.setAttribute("x", `${dirty.minX}`);
      stage.dirtyRectShape.setAttribute("y", `${dirty.minY}`);
      stage.dirtyRectShape.setAttribute("width", `${dirty.width}`);
      stage.dirtyRectShape.setAttribute("height", `${dirty.height}`);
      stage.dirtyRectOverlay.style.visibility = "";
    },
    updateViewport(nextWidth, nextHeight) {
      const previousWidth = width;
      const previousHeight = height;
      width = nextWidth;
      height = nextHeight;
      applyHotCanvasPixelRatio(previousWidth, previousHeight);
    },
    setTilePixelRatio(nextPixelRatio) {
      tilePixelRatio = nextPixelRatio;
      applyHotCanvasPixelRatio();
    },
    getTilePixelRatio() {
      return tilePixelRatio;
    },
    setRenderIdentity(renderIdentity) {
      currentRenderIdentity = renderIdentity;
      logDiagnosticEvent("pipeline_render_identity_set", {
        renderIdentity,
      });
      layerStack.setRenderIdentity(renderIdentity);
      layerStack.prewarmActiveLayerDraftComposite();
    },
    bakeInitialShapes(shapes) {
      if (!shapes.length) {
        return;
      }
      const shapeIds = shapes.map((shape) => shape.id);
      layerStack.routeDirtyShapes(shapeIds, []);
    },
    setLayers(layers) {
      endDraftSession();
      orderedLayers = [...layers].sort((a, b) => {
        if (a.zIndex === b.zIndex) {
          return 0;
        }
        return a.zIndex < b.zIndex ? -1 : 1;
      });
      logDiagnosticEvent("pipeline_layers_set", {
        layerCount: orderedLayers.length,
        layers: orderedLayers.map((layer) => ({
          id: layer.id,
          kind: layer.kind,
        })),
      });
      layerStack.setLayers(orderedLayers);
      layerStack.setActiveLayer(store.getActiveLayerId());
      layerStack.prewarmActiveLayerDraftComposite();
    },
    scheduleBakeForClear() {
      logDiagnosticEvent("pipeline_schedule_bake_for_clear");
      layerStack.scheduleFullInvalidation();
    },
    bakePendingTiles() {
      logDiagnosticEvent("pipeline_bake_pending_tiles_requested");
      void layerStack.flushBakes().catch(reportRenderError);
    },
    flushBakes() {
      logDiagnosticEvent("pipeline_flush_bakes_requested");
      return layerStack.flushBakes();
    },
    dispose() {
      disposed = true;
      disposeDeferredImageListener();
      endDraftSession();
      layerStack.dispose();
      hotLayer.clear();
      hotLayer.setDraftComposite(null);
      stage.hotOverlayCanvas.style.display = "none";
    },
  };
}
