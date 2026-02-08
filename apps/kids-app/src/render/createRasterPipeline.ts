import { type AnyShape, type DrawingStore } from "@smalldraw/core";
import { BoxOperations, Vec2 } from "@smalldraw/geometry";
import {
  HotLayer,
  RasterSession,
  TILE_SIZE,
  TileRenderer,
  createDomLayerController,
  createDomTileProvider,
} from "@smalldraw/renderer-raster";
import type { KidsDrawStage } from "../view/KidsDrawStage";

export interface RasterPipeline {
  render(): void;
  updateDirtyRectOverlay(): void;
  updateViewport(width: number, height: number): void;
  setTilePixelRatio(pixelRatio: number): void;
  getTilePixelRatio(): number;
  setRenderIdentity(renderIdentity: string): void;
  bakeInitialShapes(shapes: AnyShape[]): void;
  scheduleBakeForClear(): void;
  bakePendingTiles(): void;
  dispose(): void;
}

export function createRasterPipeline(options: {
  store: DrawingStore;
  stage: KidsDrawStage;
  width: number;
  height: number;
  backgroundColor: string;
  tilePixelRatio: number;
  renderIdentity: string;
}): RasterPipeline {
  const { store, stage, backgroundColor } = options;
  let width = options.width;
  let height = options.height;
  let tilePixelRatio = options.tilePixelRatio;

  const tileProvider = createDomTileProvider(stage.tileLayer, {
    getPixelRatio: () => tilePixelRatio,
    getTileIdentity: () => currentRenderIdentity,
  });

  const tileRenderer = new TileRenderer(store, tileProvider, {
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
        tileRenderer.renderShapes(ctx, store.getOrderedShapes());
        ctx.restore();
      },
    },
  });

  let currentRenderIdentity = options.renderIdentity;
  tileRenderer.updateViewport({ min: [0, 0], max: [width, height] });

  const hotLayer = new HotLayer(stage.hotCanvas, {
    backgroundColor: undefined,
  });
  const layerController = createDomLayerController(stage.tileLayer, stage.hotCanvas);
  hotLayer.setViewport({
    width,
    height,
    center: new Vec2(width / 2, height / 2),
    scale: 1,
  });

  const session = new RasterSession(store, tileRenderer, hotLayer, {
    layerController,
  });

  const hotCtx = stage.hotCanvas.getContext("2d");
  if (!hotCtx) {
    throw new Error("kids-app hot canvas requires a 2D context");
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
    hotCtx.setTransform(1, 0, 0, 1, 0, 0);
    hotCtx.clearRect(0, 0, stage.hotCanvas.width, stage.hotCanvas.height);
  };

  applyHotCanvasPixelRatio();

  return {
    render() {
      session.render();
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
    },
  };
}
