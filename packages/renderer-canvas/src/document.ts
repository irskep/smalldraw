import type {
  AnyShape,
  DrawingDocument,
  DrawingLayer,
  Shape,
  ShapeHandlerRegistry,
} from "@smalldraw/core";
import { computeSelectionBounds, getOrderedShapes } from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import { renderShape, type ShapeRendererRegistry } from "./shapes";

export interface RenderDocumentOptions {
  clear?: boolean;
  registry: ShapeRendererRegistry;
  geometryHandlerRegistry?: ShapeHandlerRegistry;
}

export interface OrderedShapeBounds {
  bounds?: Box;
  shapeBounds: Map<string, Box>;
}

export interface RenderLayerStackOptions extends RenderDocumentOptions {
  resolveImage: (src: string) => CanvasImageSource | null;
  documentWidth: number;
  documentHeight: number;
}

export interface DocumentOrderedShapeBounds extends OrderedShapeBounds {
  orderedShapes: AnyShape[];
}

export function renderOrderedShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  options: RenderDocumentOptions,
): void {
  const { clear = true, registry } = options;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  if (clear) {
    ctx.clearRect(0, 0, width, height);
  }
  const geometryRegistry = options.geometryHandlerRegistry;
  for (const shape of shapes) {
    renderShape(ctx, shape, registry, geometryRegistry);
  }
}

export function renderDocument(
  ctx: CanvasRenderingContext2D,
  document: DrawingDocument,
  options: RenderDocumentOptions,
): void {
  const orderedShapes = getOrderedShapes(document);
  renderOrderedShapes(ctx, orderedShapes, options);
}

export function renderLayerStack(
  ctx: CanvasRenderingContext2D,
  layers: DrawingLayer[],
  shapes: Shape[],
  options: RenderLayerStackOptions,
): void {
  const { resolveImage, documentWidth, documentHeight, ...renderOptions } =
    options;
  if (renderOptions.clear !== false) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  const shapesByLayer = partitionShapesByLayer(shapes);
  for (const layer of layers) {
    if (layer.visible === false) {
      continue;
    }
    if (layer.kind === "image") {
      const src = layer.image?.src;
      if (!src) {
        continue;
      }
      const image = resolveImage(src);
      if (!image) {
        continue;
      }
      ctx.drawImage(image, 0, 0, documentWidth, documentHeight);
      continue;
    }
    const layerShapes = shapesByLayer.get(layer.id);
    if (!layerShapes || layerShapes.length === 0) {
      continue;
    }
    renderOrderedShapes(ctx, layerShapes, {
      ...renderOptions,
      clear: false,
    });
  }
}

function partitionShapesByLayer(shapes: Shape[]): Map<string, Shape[]> {
  const result = new Map<string, Shape[]>();
  for (const shape of shapes) {
    const layerId = shape.layerId ?? "default";
    const group = result.get(layerId);
    if (group) {
      group.push(shape);
      continue;
    }
    result.set(layerId, [shape]);
  }
  return result;
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
