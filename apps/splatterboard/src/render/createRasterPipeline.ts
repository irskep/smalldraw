import type {
  AnyShape,
  DrawingLayer,
  DrawingStore,
  Shape,
} from "@smalldraw/core";
import { BoxOperations, Vec2 } from "@smalldraw/geometry";
import {
  renderLayerStack,
  type ShapeRendererRegistry,
} from "@smalldraw/renderer-canvas";
import {
  createDomLayerController,
  createDomTileProvider,
  HotLayer,
  RasterSession,
  TILE_SIZE,
  TileRenderer,
} from "@smalldraw/renderer-raster";
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
  let overlayDirty = true;
  let overlayOrderedShapesRef: unknown = null;
  let overlayDraftSignature = "";

  const getBaseDrawingLayer = (): DrawingLayer | null => {
    for (const layer of orderedLayers) {
      if (layer.kind === "drawing") {
        return layer;
      }
    }
    return null;
  };

  const getOverlayLayers = (): DrawingLayer[] => {
    const baseLayer = getBaseDrawingLayer();
    if (!baseLayer) {
      return orderedLayers;
    }
    const baseIndex = orderedLayers.findIndex(
      (layer) => layer.id === baseLayer.id,
    );
    if (baseIndex < 0 || baseIndex >= orderedLayers.length - 1) {
      return [];
    }
    return orderedLayers.slice(baseIndex + 1);
  };

  const getOverlayLayerIdSet = (): Set<string> => {
    return new Set(getOverlayLayers().map((layer) => layer.id));
  };

  const getBaseDrafts = () => {
    const baseLayerId = getBaseDrawingLayer()?.id;
    if (!baseLayerId) {
      return [];
    }
    return store
      .getDrafts()
      .filter((draft) => (draft.layerId ?? "default") === baseLayerId);
  };

  const getOverlayDrafts = () => {
    const overlayLayerIds = getOverlayLayerIdSet();
    if (overlayLayerIds.size === 0) {
      return [];
    }
    return store
      .getDrafts()
      .filter((draft) => overlayLayerIds.has(draft.layerId ?? "default"));
  };

  const getOrderedOverlayShapes = (): Shape[] => {
    const overlayLayerIds = getOverlayLayerIdSet();
    if (overlayLayerIds.size === 0) {
      return [];
    }
    return store
      .getOrderedShapes()
      .filter((shape) => overlayLayerIds.has(shape.layerId ?? "default"));
  };

  const getOverlayDraftSignature = (
    drafts: Array<{ id: string; zIndex: string; layerId?: string }>,
  ): string => {
    if (drafts.length === 0) {
      return "";
    }
    return drafts
      .map(
        (draft) => `${draft.id}:${draft.zIndex}:${draft.layerId ?? "default"}`,
      )
      .join("|");
  };

  const tileProvider = createDomTileProvider(stage.tileLayer, {
    getPixelRatio: () => tilePixelRatio,
    getTileIdentity: () => currentRenderIdentity,
  });

  const tileRenderer = new TileRenderer(store, tileProvider, {
    shapeRendererRegistry,
    backgroundColor,
    renderIdentity: options.renderIdentity,
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
        ctx.setTransform(
          tileScaleX,
          0,
          0,
          tileScaleY,
          -coord.x * TILE_SIZE * tileScaleX,
          -coord.y * TILE_SIZE * tileScaleY,
        );
        const baseLayer = getBaseDrawingLayer();
        if (baseLayer) {
          renderLayerStack(ctx, [baseLayer], store.getOrderedShapes(), {
            registry: shapeRendererRegistry,
            geometryHandlerRegistry: store.getShapeHandlers(),
            clear: false,
            resolveImage: (src) => getLoadedRasterImage(src) ?? null,
            documentWidth: width,
            documentHeight: height,
          });
        }
        ctx.restore();
      },
    },
  });

  let currentRenderIdentity = options.renderIdentity;
  tileRenderer.updateViewport({ min: [0, 0], max: [width, height] });

  const hotLayer = new HotLayer(stage.hotCanvas, {
    shapeRendererRegistry,
    backgroundColor: undefined,
  });
  const layerController = createDomLayerController(
    stage.tileLayer,
    stage.hotCanvas,
  );
  hotLayer.setViewport({
    width,
    height,
    center: new Vec2(width / 2, height / 2),
    scale: 1,
  });

  const session = new RasterSession(store, tileRenderer, hotLayer, {
    layerController,
    getDrafts: () => getBaseDrafts(),
  });

  const hotCtx = stage.hotCanvas.getContext("2d");
  if (!hotCtx) {
    throw new Error("splatterboard hot canvas requires a 2D context");
  }
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
    hotCtx.setTransform(1, 0, 0, 1, 0, 0);
    hotCtx.clearRect(0, 0, stage.hotCanvas.width, stage.hotCanvas.height);
    hotOverlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    hotOverlayCtx.clearRect(
      0,
      0,
      stage.hotOverlayCanvas.width,
      stage.hotOverlayCanvas.height,
    );
    overlayDirty = true;
  };

  const hideHotOverlay = (): void => {
    stage.hotOverlayCanvas.style.display = "none";
    hotOverlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    hotOverlayCtx.clearRect(
      0,
      0,
      stage.hotOverlayCanvas.width,
      stage.hotOverlayCanvas.height,
    );
  };

  const renderHotOverlay = (): void => {
    const overlayLayers = getOverlayLayers();
    const overlayDrafts = getOverlayDrafts();

    if (overlayLayers.length === 0 && overlayDrafts.length === 0) {
      hideHotOverlay();
      return;
    }

    const allImagesReady = overlayLayers.every(
      (layer) =>
        layer.kind !== "image" ||
        !layer.image?.src ||
        getLoadedRasterImage(layer.image.src) != null,
    );
    if (!allImagesReady) {
      stage.hotOverlayCanvas.style.display = "none";
      return;
    }

    const orderedShapes = store.getOrderedShapes();
    if (orderedShapes !== overlayOrderedShapesRef) {
      overlayOrderedShapesRef = orderedShapes;
      overlayDirty = true;
    }

    const draftSignature = getOverlayDraftSignature(overlayDrafts);
    if (draftSignature !== overlayDraftSignature) {
      overlayDraftSignature = draftSignature;
      overlayDirty = true;
    }

    if (!overlayDirty) {
      return;
    }

    const committedOverlayShapes = getOrderedOverlayShapes();
    const overlayShapes = [...committedOverlayShapes, ...overlayDrafts].sort(
      (a, b) => {
        if (a.zIndex === b.zIndex) {
          return 0;
        }
        return a.zIndex < b.zIndex ? -1 : 1;
      },
    );

    stage.hotOverlayCanvas.style.display = "block";
    hotOverlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    hotOverlayCtx.clearRect(
      0,
      0,
      stage.hotOverlayCanvas.width,
      stage.hotOverlayCanvas.height,
    );

    const scaleX = stage.hotOverlayCanvas.width / width;
    const scaleY = stage.hotOverlayCanvas.height / height;
    hotOverlayCtx.save();
    hotOverlayCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    renderLayerStack(hotOverlayCtx, overlayLayers, overlayShapes, {
      registry: shapeRendererRegistry,
      geometryHandlerRegistry: store.getShapeHandlers(),
      clear: false,
      resolveImage: (src) => getLoadedRasterImage(src) ?? null,
      documentWidth: width,
      documentHeight: height,
    });

    hotOverlayCtx.restore();
    overlayDirty = false;
  };

  applyHotCanvasPixelRatio();

  return {
    render() {
      session.render();
      renderHotOverlay();
    },
    updateDirtyRectOverlay() {
      if (!stage.dirtyRectOverlay || !stage.dirtyRectShape) {
        return;
      }
      const preview = store.getPreview();
      const hasDrafts = store.getDrafts().length > 0;
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
      tileRenderer.updateViewport({ min: [0, 0], max: [width, height] });
      hotLayer.setViewport({
        width,
        height,
        center: new Vec2(width / 2, height / 2),
        scale: 1,
      });
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
      tileRenderer.setRenderIdentity(renderIdentity);
    },
    bakeInitialShapes(shapes) {
      if (!shapes.length) return;
      for (const shape of shapes) {
        tileRenderer.updateTouchedTilesForShape(shape);
      }
      tileRenderer.scheduleBakeForShapes(shapes.map((shape) => shape.id));
      void tileRenderer.bakePendingTiles();
    },
    setLayers(layers) {
      orderedLayers = [...layers].sort((a, b) => {
        if (a.zIndex === b.zIndex) {
          return 0;
        }
        return a.zIndex < b.zIndex ? -1 : 1;
      });
      overlayOrderedShapesRef = null;
      overlayDraftSignature = "";
      overlayDirty = true;
    },
    scheduleBakeForClear() {
      tileRenderer.scheduleBakeForClear();
    },
    bakePendingTiles() {
      void tileRenderer.bakePendingTiles();
    },
    dispose() {
      tileRenderer.dispose();
      layerController.setMode("tiles");
      hotLayer.clear();
      hotLayer.setBackdrop(null);
      hideHotOverlay();
    },
  };
}
