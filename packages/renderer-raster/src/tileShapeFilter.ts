import {
  type AnyShape,
  getGeometryLocalBounds,
  normalizeShapeTransform,
  type Shape,
  type ShapeHandlerRegistry,
} from "@smalldraw/core";
import { type Box, BoxOperations, getX, getY, Vec2 } from "@smalldraw/geometry";
import { Mat2d } from "gl-matrix";

/** Committed shapes are immutable. Weak keys reuse bounds without retaining old documents. */
export function createTileShapeFilter(registry: ShapeHandlerRegistry) {
  const bounds = new WeakMap<Shape, Box | null>();
  return (shapes: Shape[], tileBounds: Box): Shape[] => {
    const tile = new BoxOperations(tileBounds);
    return shapes.filter((shape) => {
      if (!bounds.has(shape))
        bounds.set(shape, getPaintBounds(shape, registry));
      const box = bounds.get(shape);
      // Unknown/global geometry must still execute in its original order.
      if (!box) return true;
      return !(
        getX(box.max) < tile.minX ||
        getX(box.min) > tile.maxX ||
        getY(box.max) < tile.minY ||
        getY(box.min) > tile.maxY
      );
    });
  };
}

function getPaintBounds(
  shape: Shape,
  registry: ShapeHandlerRegistry,
): Box | null {
  const local = getGeometryLocalBounds(shape as AnyShape, registry);
  if (!local) return null;
  // Some handlers include stroke width and others report only geometry. Extra
  // padding is intentionally conservative (including the default miter limit).
  const padding = Math.max(0, shape.style.stroke?.size ?? 0) * 5;
  const min = new Vec2(getX(local.min), getY(local.min)).sub([
    padding,
    padding,
  ]);
  const max = new Vec2(getX(local.max), getY(local.max)).add([
    padding,
    padding,
  ]);
  const transform = normalizeShapeTransform(shape.transform);
  // Match renderer-canvas's T * R * S * T(-origin), including nonzero origins.
  const matrix = Mat2d.fromTranslation(new Mat2d(), transform.translation);
  Mat2d.rotate(matrix, matrix, transform.rotation);
  Mat2d.scale(matrix, matrix, transform.scale);
  Mat2d.translate(matrix, matrix, new Vec2(transform.origin).negate());
  return BoxOperations.fromPointArray(
    [min, new Vec2(max.x, min.y), max, new Vec2(min.x, max.y)].map((point) =>
      Vec2.transformMat2d(new Vec2(), point, matrix),
    ),
  );
}
