import { Vec2 } from "gl-matrix";

/**
 * Calculate distance between two points.
 */
export function distance(a: Vec2, b: Vec2): number {
  return Vec2.distance(a, b);
}

export function rotatePoint(point: Vec2, angle: number): Vec2 {
  const result = new Vec2();
  Vec2.rotate(result, point, [0, 0], angle);
  return result;
}

export function angleBetween(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
}
