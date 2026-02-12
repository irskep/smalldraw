import type { Shape, ShapeHandlerRegistry } from "@smalldraw/core";
import { normalizeShapeTransform } from "@smalldraw/core";
import { getX, getY } from "@smalldraw/geometry";

export type ShapeRenderer = (
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  geometryRegistry?: ShapeHandlerRegistry,
) => void;

export type ShapeRendererRegistry = Map<string, ShapeRenderer>;

export function renderShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  registry: ShapeRendererRegistry,
  geometryRegistry?: ShapeHandlerRegistry,
): void {
  const renderer = registry.get(shape.type);
  if (!renderer) {
    if (shape.type === "clear") {
      // We avoid shape-specific special cases, but clear is uniquely non-renderable by design.
      return;
    }
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
