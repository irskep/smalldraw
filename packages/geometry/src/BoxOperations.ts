import { Vec2 } from "gl-matrix";
import { makePoint } from "./makePoint";
import type { Box, Point } from "./types";
import { allValuesAreFinite } from "./util";

export class BoxOperations {
  box: Box;

  constructor(box: Box) {
    this.box = box;
  }

  static fromPointPair(a: Point, b: Point): Box {
    return {
      min: makePoint(Math.min(a.x, b.x), Math.min(a.y, b.y)),
      max: makePoint(Math.max(a.x, b.x), Math.max(a.y, b.y)),
    };
  }

  static fromPointArray(points: Point[]): Box | null {
    if (!points.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      if (!allValuesAreFinite([point.x, point.y])) return null;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    if (!allValuesAreFinite([minX, minY, maxX, maxY])) {
      return null;
    }
    return {
      min: makePoint(minX, minY),
      max: makePoint(maxX, maxY),
    };
  }

  static fromBoxPair(a: Box, b: Box): Box {
    // biome-ignore lint/style/noNonNullAssertion: there are four lights
    return BoxOperations.fromPointArray([a.min, a.max, b.min, b.max])!;
  }

  static fromCenterAndSize(center: Point, size: Point): Box {
    const halfSize = makePoint(size).div([2, 2]);
    return {
      min: makePoint(center).sub(halfSize),
      max: makePoint(center).add(halfSize),
    };
  }

  static fromMinAndSize(min: Point, size: Point): Box {
    return {
      min,
      max: makePoint(min).add(size),
    };
  }

  get size(): Point {
    return Vec2.subtract(new Vec2(), this.box.max, this.box.min) as Vec2;
  }

  get center(): Point {
    return Vec2.scaleAndAdd(new Vec2(), this.box.min, this.size, 0.5) as Vec2;
  }

  get width(): number {
    return this.box.max[0] - this.box.min[0];
  }
  get height(): number {
    return this.box.max[1] - this.box.min[1];
  }

  get minX(): number {
    return this.box.min[0];
  }
  get maxX(): number {
    return this.box.max[0];
  }
  get minY(): number {
    return this.box.min[1];
  }
  get maxY(): number {
    return this.box.max[1];
  }

  containsPoint(point: Point): boolean {
    return (
      point.x >= this.minX &&
      point.x <= this.maxX &&
      point.y >= this.minY &&
      point.y <= this.maxY
    );
  }

  translate(point: Point): Box {
    return {
      min: new Vec2().add(this.box.min).add(point),
      max: new Vec2().add(this.box.max).add(point),
    };
  }
}
