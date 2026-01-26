import {
  type Box,
  BoxOperations,
  makePoint,
  type Point,
  rotatePoint,
} from "@smalldraw/geometry";
import type {
  AnyShape,
  CanonicalShapeTransform,
  Shape,
  ShapeTransform,
} from "./shape";
import { normalizeShapeTransform } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

export function getGeometryLocalBounds(
  shape: AnyShape,
  registry: ShapeHandlerRegistry,
): Box | null {
  const ops = registry.get(shape.type)?.geometry;
  if (ops?.getBounds) {
    return ops.getBounds(shape);
  }
  return null;
}

export function applyTransformToPoint(
  point: Point,
  transform?: ShapeTransform | CanonicalShapeTransform | null,
): Point {
  const normalized = normalizeShapeTransform(transform ?? undefined);
  const { translation, rotation, scale, origin } = normalized;
  const translated = makePoint(point).sub(origin).mul(scale);
  const rotated =
    rotation === 0 ? translated : rotatePoint(translated, rotation);
  return makePoint(rotated).add(origin).add(translation);
}

export function getShapeBounds(
  shape: AnyShape,
  registry: ShapeHandlerRegistry,
  transformOverride?: ShapeTransform | CanonicalShapeTransform | null,
): Box {
  const transform = normalizeShapeTransform(
    transformOverride ?? shape.transform,
  );
  const geometryBounds = getGeometryLocalBounds(shape, registry);
  const corners: Point[] = geometryBounds
    ? [
        makePoint(geometryBounds.min.x, geometryBounds.min.y),
        makePoint(geometryBounds.max.x, geometryBounds.min.y),
        makePoint(geometryBounds.max.x, geometryBounds.max.y),
        makePoint(geometryBounds.min.x, geometryBounds.max.y),
      ]
    : [makePoint()];
  const baseBounds = BoxOperations.fromPointArray(
    corners.map((corner) => applyTransformToPoint(corner, transform)),
  );
  if (!baseBounds) {
    const { translation } = transform;
    return { min: translation, max: translation };
  }
  return applyStrokePadding(baseBounds, shape);
}

function applyStrokePadding(bounds: Box, shape: Shape): Box {
  const strokeWidth = shape.stroke?.size ?? 0;
  if (!strokeWidth) {
    return bounds;
  }
  const padding = strokeWidth / 2;
  return {
    min: makePoint(bounds.min.sub(makePoint(padding))),
    max: makePoint(bounds.max.add(makePoint(padding))),
  };
}
