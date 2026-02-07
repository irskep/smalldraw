import {
  BoxOperations,
  getX,
  getY,
  type Box,
  type Vec2Tuple,
  toVec2,
  toVec2Like,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import type { StrokeOptions as FreehandStrokeOptions } from "perfect-freehand";
import getStroke from "perfect-freehand";
import type { PenShape } from "./shapes/penShape";

const DEFAULT_PEN_STROKE_OPTIONS = {
  smoothing: 0.6,
  streamline: 0.4,
  thinning: 0.6,
} satisfies Partial<FreehandStrokeOptions>;

export function getPenStrokeOptions(
  shape: PenShape,
): FreehandStrokeOptions | null {
  const size = shape.style?.stroke?.size;
  if (!size) {
    return null;
  }
  return {
    size,
    simulatePressure: !!shape.geometry.pressures,
    ...DEFAULT_PEN_STROKE_OPTIONS,
  };
}

export function getPenStrokeOutline(shape: PenShape): Vec2Tuple[] {
  if (!shape.geometry.points.length) {
    return [];
  }
  const options = getPenStrokeOptions(shape);
  if (!options) {
    return [];
  }
  const outline = getStroke(
    shape.geometry.points.map((point) => [getX(point), getY(point)]),
    options,
  ) as Vec2Tuple[];
  if (!outline.length) {
    return createDotStroke(shape.geometry.points[0], options);
  }
  return outline;
}

export function getPenStrokeBounds(shape: PenShape): Box | null {
  const outline = getPenStrokeOutline(shape);
  if (!outline.length) {
    return null;
  }
  return BoxOperations.fromPointArray(outline);
}

function createDotStroke(
  point: Vec2Tuple,
  options: FreehandStrokeOptions,
): Vec2Tuple[] {
  const radius = Math.max(1, (options.size ?? 1) / 2);
  const delta = new Vec2(radius);
  const center = toVec2(point);
  return [
    toVec2Like(new Vec2().add(center).sub(delta)),
    toVec2Like(new Vec2().add(center).sub(delta).add(new Vec2(2 * radius, 0))),
    toVec2Like(new Vec2().add(center).add(delta)),
    toVec2Like(new Vec2().add(center).add(delta).sub(new Vec2(2 * radius, 0))),
  ];
}
