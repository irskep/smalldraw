import { allValuesAreFinite } from "../util";
import type { Bounds, Point } from "./primitives";

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
