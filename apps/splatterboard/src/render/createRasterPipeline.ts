import type { AnyShape, DrawingLayer, DrawingStore } from "@smalldraw/core";
import { BoxOperations, Vec2 } from "@smalldraw/geometry";
import type { ShapeRendererRegistry } from "@smalldraw/renderer-canvas";
import { createLayerStack, HotLayer } from "@smalldraw/renderer-raster";
import { getLoadedRasterImage } from "../shapes/rasterImageCache";
import type { KidsDrawStage } from "../view/KidsDrawStage";

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
  let draftSessionActive = false;
  let draftCaptureInFlight: Promise<void> | null = null;
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

  const applyHotCanvasPixelRatio = (): void => {
    const nextWidth = Math.max(1, Math.round(width * tilePixelRatio));
    const nextHeight = Math.max(1, Math.round(height * tilePixelRatio));
    if (stage.hotCanvas.width !== nextWidth) {
      stage.hotCanvas.width = nextWidth;
    }
    if (stage.hotCanvas.height !== nextHeight) {
      stage.hotCanvas.height = nextHeight;
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
    knownClearShapeIds.clear();
    for (const [shapeId, shape] of Object.entries(store.getDocument().shapes)) {
      if (shape.type === "clear") {
        knownClearShapeIds.add(shapeId);
      }
    }
  };

  const beginDraftSession = (): void => {
    if (draftSessionActive || draftCaptureInFlight) {
      return;
    }
    draftCaptureInFlight = layerStack
      .beginActiveLayerDraftSession()
      .then(() => {
        hotLayer.setBackdrop(layerStack.getActiveLayerBackdropSnapshot());
        draftSessionActive = true;
      })
      .finally(() => {
        draftCaptureInFlight = null;
        renderInternal();
      });
  };

  const endDraftSession = (): void => {
    if (!draftSessionActive) {
      return;
    }
    hotLayer.clear();
    hotLayer.setBackdrop(null);
    layerStack.endActiveLayerDraftSession();
    draftSessionActive = false;
    stage.hotCanvas.style.visibility = "hidden";
  };

  const renderInternal = (): void => {
    layerStack.setActiveLayer(store.getActiveLayerId());
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

    if (hasClearMutation(dirtyShapeIds, deletedShapeIds)) {
      layerStack.scheduleFullInvalidation();
    } else {
      layerStack.routeDirtyShapes(dirtyShapeIds, deletedShapeIds);
    }

    const drafts = getActiveLayerDrafts();
    if (drafts.length === 0) {
      endDraftSession();
      updateKnownClearShapeIds();
      return;
    }

    if (!draftSessionActive) {
      beginDraftSession();
      updateKnownClearShapeIds();
      return;
    }

    hotLayer.renderDrafts(drafts);
    stage.hotCanvas.style.visibility = "";
    updateKnownClearShapeIds();
  };

  applyHotCanvasPixelRatio();
  layerStack.setRenderIdentity(currentRenderIdentity);

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
      width = nextWidth;
      height = nextHeight;
      applyHotCanvasPixelRatio();
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
      layerStack.setRenderIdentity(renderIdentity);
    },
    bakeInitialShapes(shapes) {
      if (!shapes.length) {
        return;
      }
      const shapeIds = shapes.map((shape) => shape.id);
      layerStack.routeDirtyShapes(shapeIds, []);
    },
    setLayers(layers) {
      orderedLayers = [...layers].sort((a, b) => {
        if (a.zIndex === b.zIndex) {
          return 0;
        }
        return a.zIndex < b.zIndex ? -1 : 1;
      });
      layerStack.setLayers(orderedLayers);
      layerStack.setActiveLayer(store.getActiveLayerId());
    },
    scheduleBakeForClear() {
      layerStack.scheduleFullInvalidation();
    },
    bakePendingTiles() {
      void layerStack.flushBakes();
    },
    flushBakes() {
      return layerStack.flushBakes();
    },
    dispose() {
      endDraftSession();
      layerStack.dispose();
      hotLayer.clear();
      hotLayer.setBackdrop(null);
      stage.hotOverlayCanvas.style.display = "none";
    },
  };
}
