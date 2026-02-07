import type { AnyShape, Shape, ShapeHandlerRegistry } from "@smalldraw/core";
import { normalizeShapeTransform } from "@smalldraw/core";
import { getX, getY } from "@smalldraw/geometry";
import { renderPen } from "./shapes/pen";
import { renderRect } from "./shapes/rect";

export type ShapeRenderer = (
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  geometryRegistry?: ShapeHandlerRegistry,
) => void;

export type ShapeRendererRegistry = Map<string, ShapeRenderer>;

function createDefaultShapeRendererRegistry(): ShapeRendererRegistry {
  const registry = new Map<string, ShapeRenderer>();
  registry.set("rect", (ctx, shape, _geometryRegistry) =>
    renderRect(
      ctx,
      shape as AnyShape & { geometry: { type: "rect"; size: [number, number] } },
    ),
  );
  registry.set("pen", (ctx, shape) =>
    renderPen(ctx, shape as AnyShape & { geometry: { type: "pen" } }),
  );
  return registry;
}

export function createShapeRendererRegistry(
  overrides?: Map<string, ShapeRenderer>,
): ShapeRendererRegistry {
  const registry = new Map(createDefaultShapeRendererRegistry());
  if (overrides) {
    for (const [type, renderer] of overrides) {
      registry.set(type, renderer);
    }
  }
  return registry;
}

export const defaultShapeRendererRegistry =
  createDefaultShapeRendererRegistry();

export function renderShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  registry: ShapeRendererRegistry = defaultShapeRendererRegistry,
  geometryRegistry?: ShapeHandlerRegistry,
): void {
  const renderer = registry.get(shape.type);
  if (!renderer) {
    console.warn(`No renderer for geometry type: ${shape.type}`);
    return;
  }
  ctx.save();
  applyShapeTransform(ctx, shape);
  const opacity = shape.style.opacity ?? 1;
  ctx.globalAlpha = ctx.globalAlpha * opacity;
  renderer(ctx, shape, geometryRegistry);
  ctx.restore();
}

function applyShapeTransform(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
): void {
  const transform = normalizeShapeTransform(shape.transform);
  ctx.translate(getX(transform.translation), getY(transform.translation));
  ctx.rotate(transform.rotation);
  ctx.scale(getX(transform.scale), getY(transform.scale));
  ctx.translate(-getX(transform.origin), -getY(transform.origin));
}
