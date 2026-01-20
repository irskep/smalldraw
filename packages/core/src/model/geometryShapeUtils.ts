import { createBounds, getBoundsFromPoints } from "./geometryUtils";
import type { Bounds, Point } from "./primitives";
import type { CanonicalShapeTransform, Shape, ShapeTransform } from "./shape";
import { normalizeShapeTransform } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

type ShapeWithGeometry = Shape & { geometry: unknown };

export function getGeometryLocalBounds(
  shape: ShapeWithGeometry,
  registry: ShapeHandlerRegistry,
): Bounds | null {
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
  const translated = {
    x: (point.x - origin.x) * scale.x,
    y: (point.y - origin.y) * scale.y,
  };
  const rotated =
    rotation === 0 ? translated : rotatePoint(translated, rotation);
  return {
    x: rotated.x + origin.x + translation.x,
    y: rotated.y + origin.y + translation.y,
  };
}

function rotatePoint(point: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function getShapeBounds(
  shape: Shape,
  registry: ShapeHandlerRegistry,
  transformOverride?: ShapeTransform | CanonicalShapeTransform | null,
): Bounds {
  const transform = normalizeShapeTransform(
    transformOverride ?? shape.transform,
  );
  const geometryBounds = getGeometryLocalBounds(
    shape as ShapeWithGeometry,
    registry,
  );
  const corners: Point[] = geometryBounds
    ? [
        { x: geometryBounds.minX, y: geometryBounds.minY },
        { x: geometryBounds.maxX, y: geometryBounds.minY },
        { x: geometryBounds.maxX, y: geometryBounds.maxY },
        { x: geometryBounds.minX, y: geometryBounds.maxY },
      ]
    : [{ x: 0, y: 0 }];
  const baseBounds = getBoundsFromPoints(
    corners.map((corner) => applyTransformToPoint(corner, transform)),
  );
  if (!baseBounds) {
    const { translation } = transform;
    return createBounds(
      translation.x,
      translation.y,
      translation.x,
      translation.y,
    );
  }
  return applyStrokePadding(baseBounds, shape);
}

function applyStrokePadding(bounds: Bounds, shape: Shape): Bounds {
  const strokeWidth = shape.stroke?.size ?? 0;
  if (!strokeWidth) {
    return bounds;
  }
  const padding = strokeWidth / 2;
  return createBounds(
    bounds.minX - padding,
    bounds.minY - padding,
    bounds.maxX + padding,
    bounds.maxY + padding,
  );
}
