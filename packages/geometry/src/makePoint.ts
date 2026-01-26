import { Vec2, type Vec2Like } from "gl-matrix";
import type { Point } from "./types";

export function makePoint(
  x: number | undefined | Vec2Like = undefined,
  y: number | undefined = undefined,
): Point {
  if (Number.isFinite(x)) {
    return y !== undefined
      ? new Vec2(x as number, y)
      : new Vec2(x as number, x as number);
  } else if (x) {
    return new Vec2(x as Vec2Like);
  } else {
    return new Vec2(0, 0);
  }
}
