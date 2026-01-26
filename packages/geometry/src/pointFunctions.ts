import { Vec2 } from "gl-matrix";
import type { Point } from "./types";

/**
 * Calculate distance between two points.
 */
export function distance(a: Point, b: Point): number {
  return Vec2.distance(a, b);
}

export function rotatePoint(point: Point, angle: number): Point {
  const result = new Vec2();
  Vec2.rotate(result, point, [0, 0], angle);
  return result;
}

export function angleBetween(a: Point, b: Point): number {
  return Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
}
