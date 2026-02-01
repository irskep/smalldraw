import { Vec2, type Vec2Like } from "gl-matrix";
import type { Box } from "./types";
import { allValuesAreFinite, getX, getY, toVec2 } from "./util";

export class BoxOperations {
  box: Box;

  constructor(box: Box) {
    this.box = box;
  }

  static fromPointPair(a: Vec2Like, b: Vec2Like): Box {
    return {
      min: new Vec2(Math.min(getX(a), getX(b)), Math.min(getY(a), getY(b))),
      max: new Vec2(Math.max(getX(a), getX(b)), Math.max(getY(a), getY(b))),
    };
  }

  static fromPointArray(points: Vec2Like[]): Box | null {
    if (!points.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      if (!allValuesAreFinite([getX(point), getY(point)])) return null;
      minX = Math.min(minX, getX(point));
      minY = Math.min(minY, getY(point));
      maxX = Math.max(maxX, getX(point));
      maxY = Math.max(maxY, getY(point));
    }
    if (!allValuesAreFinite([minX, minY, maxX, maxY])) {
      return null;
    }
    return {
      min: new Vec2(minX, minY),
      max: new Vec2(maxX, maxY),
    };
  }

  static fromBoxPair(a: Box, b: Box): Box {
    // biome-ignore lint/style/noNonNullAssertion: there are four lights
    return BoxOperations.fromPointArray([a.min, a.max, b.min, b.max])!;
  }

  static fromCenterAndSize(center: Vec2Like, size: Vec2Like): Box {
    const halfSize = new Vec2(getX(size), getY(size)).div([2, 2]);
    return {
      min: new Vec2(getX(center), getY(center)).sub(halfSize),
      max: new Vec2(getX(center), getY(center)).add(halfSize),
    };
  }

  static fromMinAndSize(min: Vec2Like, size: Vec2Like): Box {
    return {
      min,
      max: new Vec2(getX(min), getY(min)).add(new Vec2(getX(size), getY(size))),
    };
  }

  get size(): Vec2 {
    return Vec2.subtract(
      new Vec2(),
      toVec2(this.box.max),
      toVec2(this.box.min),
    ) as Vec2;
  }

  get center(): Vec2 {
    return Vec2.scaleAndAdd(
      new Vec2(),
      toVec2(this.box.min),
      this.size,
      0.5,
    ) as Vec2;
  }

  get width(): number {
    return getX(this.box.max) - getX(this.box.min);
  }
  get height(): number {
    return getY(this.box.max) - getY(this.box.min);
  }

  get minX(): number {
    return getX(this.box.min);
  }
  get maxX(): number {
    return getX(this.box.max);
  }
  get minY(): number {
    return getY(this.box.min);
  }
  get maxY(): number {
    return getY(this.box.max);
  }

  containsPoint(point: Vec2Like): boolean {
    return (
      getX(point) >= this.minX &&
      getX(point) <= this.maxX &&
      getY(point) >= this.minY &&
      getY(point) <= this.maxY
    );
  }

  translate(point: Vec2Like): Box {
    return {
      min: new Vec2().add(toVec2(this.box.min)).add(toVec2(point)),
      max: new Vec2().add(toVec2(this.box.max)).add(toVec2(point)),
    };
  }
}
