import type { AnyShape, ShapeHandlerRegistry } from "@smalldraw/core";
import type { DraftShape } from "@smalldraw/core";
import { renderOrderedShapes } from "@smalldraw/renderer-canvas";
import type { Viewport } from "./viewport";
import { applyViewportToContext } from "./viewport";

export interface HotLayerOptions {
  geometryHandlerRegistry?: ShapeHandlerRegistry;
  backgroundColor?: string;
}

export class HotLayer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly geometryHandlerRegistry?: ShapeHandlerRegistry;
  private readonly backgroundColor?: string;
  private viewport: Viewport | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: HotLayerOptions = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("HotLayer requires a 2D canvas context.");
    }
    this.ctx = ctx as CanvasRenderingContext2D;
    this.geometryHandlerRegistry = options.geometryHandlerRegistry;
    this.backgroundColor = options.backgroundColor;
  }

  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
    if (this.canvas.width !== viewport.width) {
      this.canvas.width = viewport.width;
    }
    if (this.canvas.height !== viewport.height) {
      this.canvas.height = viewport.height;
    }
  }

  renderDrafts(drafts: DraftShape[] | AnyShape[]): void {
    const shapes = normalizeDraftShapes(drafts);
    this.clear();
    if (!shapes.length) {
      return;
    }
    if (this.backgroundColor) {
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.fillStyle = this.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }
    this.ctx.save();
    if (this.viewport) {
      applyViewportToContext(this.ctx, this.viewport);
    }
    const ordered = orderByZIndex(shapes);
    renderOrderedShapes(this.ctx, ordered, {
      clear: false,
      geometryHandlerRegistry: this.geometryHandlerRegistry,
    });
    this.ctx.restore();
  }

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

function normalizeDraftShapes(
  drafts: DraftShape[] | AnyShape[],
): AnyShape[] {
  return drafts.map((shape) => {
    if ("temporary" in shape && "toolId" in shape) {
      const { temporary: _temp, toolId: _tool, ...rest } = shape;
      return rest;
    }
    return shape;
  });
}

function orderByZIndex(shapes: AnyShape[]): AnyShape[] {
  return [...shapes].sort((a, b) => {
    if (a.zIndex === b.zIndex) return 0;
    return a.zIndex < b.zIndex ? -1 : 1;
  });
}
