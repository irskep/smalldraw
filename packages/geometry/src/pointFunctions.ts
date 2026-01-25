import type { Point } from "./types";

/**
 * Calculate distance between two points.
 */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function rotatePoint(point: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function angleBetween(a: Point, b: Point): number {
  return Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
}
