import type { Geometry } from './geometry';
import type { Point, Bounds } from './primitives';
import type { Shape, ShapeTransform, CanonicalShapeTransform } from './shape';
import { normalizeShapeTransform } from './shape';

function createBounds(minX: number, minY: number, maxX: number, maxY: number): Bounds {
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getBoundsFromPoints(points: Point[]): Bounds | null {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return null;
  }
  return createBounds(minX, minY, maxX, maxY);
}

export function getGeometryLocalBounds(geometry: Geometry): Bounds | null {
  switch (geometry.type) {
    case 'rect': {
      const halfWidth = geometry.size.width / 2;
      const halfHeight = geometry.size.height / 2;
      return createBounds(-halfWidth, -halfHeight, halfWidth, halfHeight);
    }
    case 'ellipse':
      return createBounds(-geometry.radiusX, -geometry.radiusY, geometry.radiusX, geometry.radiusY);
    case 'regularPolygon':
      return createBounds(-geometry.radius, -geometry.radius, geometry.radius, geometry.radius);
    case 'pen':
    case 'stroke':
    case 'polygon':
      return getBoundsFromPoints(geometry.points);
    case 'path':
      return getBoundsFromPoints(geometry.segments.flatMap((segment) => segment.points));
    case 'bezier':
      return getBoundsFromPoints(
        geometry.nodes.flatMap((node) =>
          [node.anchor, node.handleIn, node.handleOut].filter(
            (pt): pt is Point => Boolean(pt),
          ),
        ),
      );
    default:
      return null;
  }
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
  const rotated = rotation === 0 ? translated : rotatePoint(translated, rotation);
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
  transformOverride?: ShapeTransform | CanonicalShapeTransform | null,
): Bounds {
  const transform = normalizeShapeTransform(transformOverride ?? shape.transform);
  const geometryBounds = getGeometryLocalBounds(shape.geometry);
  const corners: Point[] = geometryBounds
    ? [
        { x: geometryBounds.minX, y: geometryBounds.minY },
        { x: geometryBounds.maxX, y: geometryBounds.minY },
        { x: geometryBounds.maxX, y: geometryBounds.maxY },
        { x: geometryBounds.minX, y: geometryBounds.maxY },
      ]
    : [{ x: 0, y: 0 }];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const corner of corners) {
    const world = applyTransformToPoint(corner, transform);
    minX = Math.min(minX, world.x);
    minY = Math.min(minY, world.y);
    maxX = Math.max(maxX, world.x);
    maxY = Math.max(maxY, world.y);
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    const { translation } = transform;
    return createBounds(translation.x, translation.y, translation.x, translation.y);
  }
  const baseBounds = createBounds(minX, minY, maxX, maxY);
  return applyStrokePadding(baseBounds, shape);
}

export function getBoundsCenter(bounds: Bounds): Point {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function createBoundsFromPoints(a: Point, b: Point): Bounds {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);
  return createBounds(minX, minY, maxX, maxY);
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
