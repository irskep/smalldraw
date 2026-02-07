import type {
  AnyShape,
  DrawingDocument,
  Shape,
  ShapeHandlerRegistry,
} from "@smalldraw/core";
import { computeSelectionBounds, getOrderedShapes } from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import {
  defaultShapeRendererRegistry,
  renderShape,
  type ShapeRendererRegistry,
} from "./shapes";

export interface RenderDocumentOptions {
  clear?: boolean;
  registry?: ShapeRendererRegistry;
  geometryHandlerRegistry?: ShapeHandlerRegistry;
}

export interface OrderedShapeBounds {
  bounds?: Box;
  shapeBounds: Map<string, Box>;
}

export interface DocumentOrderedShapeBounds extends OrderedShapeBounds {
  orderedShapes: AnyShape[];
}

export function renderOrderedShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  options: RenderDocumentOptions = {},
): void {
  const { clear = true } = options;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  if (clear) {
    ctx.clearRect(0, 0, width, height);
  }
  const registry = options.registry ?? defaultShapeRendererRegistry;
  const geometryRegistry = options.geometryHandlerRegistry;
  for (const shape of shapes) {
    renderShape(ctx, shape, registry, geometryRegistry);
  }
}

export function renderDocument(
  ctx: CanvasRenderingContext2D,
  document: DrawingDocument,
  options: RenderDocumentOptions = {},
): void {
  const orderedShapes = getOrderedShapes(document);
  renderOrderedShapes(ctx, orderedShapes, options);
}

export function getOrderedShapesBounds(
  orderedShapes: AnyShape[],
  registry: ShapeHandlerRegistry,
): OrderedShapeBounds {
  const { bounds, shapeBounds } = computeSelectionBounds(
    orderedShapes,
    registry,
  );
  return { bounds, shapeBounds };
}

export function getDocumentOrderedShapesBounds(
  document: DrawingDocument,
  registry: ShapeHandlerRegistry,
): DocumentOrderedShapeBounds {
  const orderedShapes = getOrderedShapes(document);
  const { bounds, shapeBounds } = getOrderedShapesBounds(
    orderedShapes,
    registry,
  );
  return { orderedShapes, bounds, shapeBounds };
}
