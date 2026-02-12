import type {
  AnyShape,
  DraftShape,
  ShapeHandlerRegistry,
} from "@smalldraw/core";
import { type Box, BoxOperations, getX, getY } from "@smalldraw/geometry";
import {
  renderOrderedShapes,
  type ShapeRendererRegistry,
} from "@smalldraw/renderer-canvas";
import { Vec2 } from "gl-matrix";
import { perfAddTimingMs, perfNowMs } from "./perfDebug";
import type { Viewport } from "./viewport";

export interface HotLayerOptions {
  shapeRendererRegistry: ShapeRendererRegistry;
  geometryHandlerRegistry?: ShapeHandlerRegistry;
  backgroundColor?: string;
}

export interface HotLayerRenderOptions {
  dirtyBounds?: Box | null;
}

export class HotLayer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly shapeRendererRegistry: ShapeRendererRegistry;
  private readonly geometryHandlerRegistry?: ShapeHandlerRegistry;
  private readonly backgroundColor?: string;
  private viewport: Viewport | null = null;
  private backdropImage: CanvasImageSource | null = null;
  private backdropBackgroundColor: string | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: HotLayerOptions,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("HotLayer requires a 2D canvas context.");
    }
    this.ctx = ctx as CanvasRenderingContext2D;
    this.shapeRendererRegistry = options.shapeRendererRegistry;
    this.geometryHandlerRegistry = options.geometryHandlerRegistry;
    this.backgroundColor = options.backgroundColor;
  }

  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  renderDrafts(
    drafts: DraftShape[] | AnyShape[],
    options: HotLayerRenderOptions = {},
  ): void {
    const stepStartMs = perfNowMs();
    const shapes = normalizeDraftShapes(drafts);
    const dirtyBounds =
      options.dirtyBounds && this.viewport
        ? worldBoundsToBackingRect(
            options.dirtyBounds,
            this.viewport,
            this.canvas,
          )
        : null;
    if (dirtyBounds) {
      this.clearRect(dirtyBounds);
    } else {
      this.clear();
    }
    perfAddTimingMs("hotLayer.clear.ms", perfNowMs() - stepStartMs);
    if (this.backdropImage) {
      const backdropStartMs = perfNowMs();
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (dirtyBounds) {
        const sourceSize = getImageSourceSize(this.backdropImage);
        const sourceScale = sourceSize
          ? new Vec2(sourceSize.width, sourceSize.height).div([
              this.canvas.width,
              this.canvas.height,
            ])
          : new Vec2(1, 1);
        const dirty = new BoxOperations(dirtyBounds);
        const dirtySourceMin = new Vec2(dirty.minX, dirty.minY).mul(
          sourceScale,
        );
        const dirtySourceSize = new Vec2(dirty.width, dirty.height).mul(
          sourceScale,
        );
        this.ctx.drawImage(
          this.backdropImage,
          getX(dirtySourceMin),
          getY(dirtySourceMin),
          getX(dirtySourceSize),
          getY(dirtySourceSize),
          dirty.minX,
          dirty.minY,
          dirty.width,
          dirty.height,
        );
      } else {
        this.ctx.drawImage(
          this.backdropImage,
          0,
          0,
          this.canvas.width,
          this.canvas.height,
        );
      }
      this.ctx.restore();
      perfAddTimingMs(
        "hotLayer.backdropBlit.ms",
        perfNowMs() - backdropStartMs,
      );
    }
    if (!shapes.length) {
      return;
    }
    if (!this.backdropImage && this.backgroundColor) {
      const backgroundFillStartMs = perfNowMs();
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (dirtyBounds) {
        const dirty = new BoxOperations(dirtyBounds);
        this.ctx.beginPath();
        this.ctx.rect(dirty.minX, dirty.minY, dirty.width, dirty.height);
        this.ctx.clip();
      }
      this.ctx.fillStyle = this.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
      perfAddTimingMs(
        "hotLayer.backgroundFill.ms",
        perfNowMs() - backgroundFillStartMs,
      );
    }
    const draftPaintStartMs = perfNowMs();
    this.ctx.save();
    if (dirtyBounds) {
      const dirty = new BoxOperations(dirtyBounds);
      this.ctx.beginPath();
      this.ctx.rect(dirty.minX, dirty.minY, dirty.width, dirty.height);
      this.ctx.clip();
    }
    if (this.viewport) {
      setWorldToBackingTransform(this.ctx, this.viewport, this.canvas);
    }
    const ordered = orderByZIndex(shapes);
    renderOrderedShapes(this.ctx, ordered, {
      clear: false,
      registry: this.shapeRendererRegistry,
      geometryHandlerRegistry: this.geometryHandlerRegistry,
    });
    this.ctx.restore();
    perfAddTimingMs("hotLayer.draftPaint.ms", perfNowMs() - draftPaintStartMs);
  }

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private clearRect(bounds: Box): void {
    const dirty = new BoxOperations(bounds);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(dirty.minX, dirty.minY, dirty.width, dirty.height);
  }

  setBackdrop(image: CanvasImageSource | null, backgroundColor?: string): void {
    this.backdropImage = image;
    this.backdropBackgroundColor = image ? (backgroundColor ?? null) : null;
    const canvasWithOptionalStyle = this.canvas as unknown as {
      style?: { backgroundColor: string };
    };
    if (canvasWithOptionalStyle.style) {
      canvasWithOptionalStyle.style.backgroundColor =
        this.backdropBackgroundColor ?? "";
    }
  }
}

function normalizeDraftShapes(drafts: DraftShape[] | AnyShape[]): AnyShape[] {
  return drafts as AnyShape[];
}

function orderByZIndex(shapes: AnyShape[]): AnyShape[] {
  return [...shapes].sort((a, b) => {
    if (a.zIndex === b.zIndex) return 0;
    return a.zIndex < b.zIndex ? -1 : 1;
  });
}

function setWorldToBackingTransform(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  canvas: HTMLCanvasElement,
): void {
  const metrics = getWorldToBackingMetrics(viewport, canvas);
  const worldScale = new Vec2(viewport.scale, viewport.scale).mul(
    metrics.scale,
  );
  const worldTranslate = new Vec2(metrics.translate).mul(metrics.scale);
  ctx.setTransform(
    getX(worldScale),
    0,
    0,
    getY(worldScale),
    getX(worldTranslate),
    getY(worldTranslate),
  );
}

function worldBoundsToBackingRect(
  bounds: Box,
  viewport: Viewport,
  canvas: HTMLCanvasElement,
): Box | null {
  const metrics = getWorldToBackingMetrics(viewport, canvas);
  const projectedMin = new Vec2(getX(bounds.min), getY(bounds.min))
    .mul([viewport.scale, viewport.scale])
    .add(metrics.translate)
    .mul(metrics.scale);
  const projectedMax = new Vec2(getX(bounds.max), getY(bounds.max))
    .mul([viewport.scale, viewport.scale])
    .add(metrics.translate)
    .mul(metrics.scale);
  const projectedBounds = BoxOperations.fromPointPair(
    projectedMin,
    projectedMax,
  );
  const clippedMin = new Vec2();
  Vec2.max(clippedMin, projectedBounds.min, [0, 0]);
  Vec2.floor(clippedMin, clippedMin);
  const clippedMax = new Vec2();
  Vec2.min(clippedMax, projectedBounds.max, [canvas.width, canvas.height]);
  Vec2.ceil(clippedMax, clippedMax);
  const clippedBounds: Box = {
    min: clippedMin,
    max: clippedMax,
  };
  const clippedOps = new BoxOperations(clippedBounds);
  const width = clippedOps.width;
  const height = clippedOps.height;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return clippedBounds;
}

function getWorldToBackingMetrics(
  viewport: Viewport,
  canvas: HTMLCanvasElement,
): {
  scale: Vec2;
  translate: Vec2;
} {
  const scale = new Vec2(
    canvas.width / viewport.width,
    canvas.height / viewport.height,
  );
  const translate = new Vec2(viewport.width / 2, viewport.height / 2).sub(
    new Vec2(getX(viewport.center), getY(viewport.center)).mul([
      viewport.scale,
      viewport.scale,
    ]),
  );
  return {
    scale,
    translate,
  };
}

function getImageSourceSize(
  image: CanvasImageSource,
): { width: number; height: number } | null {
  const source = image as Partial<{
    width: number;
    height: number;
    videoWidth: number;
    videoHeight: number;
  }>;
  const width = source.width ?? source.videoWidth;
  const height = source.height ?? source.videoHeight;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { width, height };
}
