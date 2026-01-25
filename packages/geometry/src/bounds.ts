import type { Bounds, Point } from "./types";
import { allValuesAreFinite } from "./util";

export function createBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Bounds {
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
  if (!allValuesAreFinite(minX, minY, maxX, maxY)) {
    return null;
  }
  return createBounds(minX, minY, maxX, maxY);
}

export function getBoundsFromPointPair(a: Point, b: Point): Bounds {
  return createBounds(
    Math.min(a.x, b.x),
    Math.min(a.y, b.y),
    Math.max(a.x, b.x),
    Math.max(a.y, b.y),
  );
}

export function getBoundsCenter(bounds: Bounds): Point {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function containsPoint(bounds: Bounds, point: Point): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

export function offsetBounds(bounds: Bounds, dx: number, dy: number): Bounds {
  return {
    minX: bounds.minX + dx,
    minY: bounds.minY + dy,
    maxX: bounds.maxX + dx,
    maxY: bounds.maxY + dy,
    width: bounds.width,
    height: bounds.height,
  };
}

/**
 * Merge two bounding boxes into a single bounding box that contains both.
 */
export function mergeBounds(a: Bounds, b: Bounds): Bounds {
  const minX = Math.min(a.minX, b.minX);
  const minY = Math.min(a.minY, b.minY);
  const maxX = Math.max(a.maxX, b.maxX);
  const maxY = Math.max(a.maxY, b.maxY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function pointAdd<T extends Point>(a: T, b: Point): T {
  return {
    ...a,
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

export function pointSubtract<T extends Point>(a: T, b: Point): T {
  return {
    ...a,
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

export function pointScalarMultiply<T extends Point>(a: T, b: number): T {
  return {
    ...a,
    x: a.x * b,
    y: a.y * b,
  };
}

export function pointPairMultiply<T extends Point>(a: T, b: Point): T {
  return {
    ...a,
    x: a.x * b.x,
    y: a.y * b.y,
  };
}
