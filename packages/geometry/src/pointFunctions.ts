import { Vec2, type Vec2Like } from "gl-matrix";
import { getX, getY, toVec2 } from "./util";

/**
 * Calculate distance between two points.
 */
export function distance(a: Vec2Like, b: Vec2Like): number {
  return Vec2.distance(toVec2(a), toVec2(b));
}

export function rotatePoint(point: Vec2Like, angle: number): Vec2 {
  const result = new Vec2();
  Vec2.rotate(result, toVec2(point), [0, 0], angle);
  return result;
}

export function angleBetween(a: Vec2Like, b: Vec2Like): number {
  return Math.atan2(getY(b), getX(b)) - Math.atan2(getY(a), getX(a));
}
