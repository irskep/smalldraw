import {
  type Box,
  BoxOperations,
  getX,
  getY,
  toVec2,
  toVec2Like,
  type Vec2Tuple,
} from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import type { StrokeOptions as FreehandStrokeOptions } from "perfect-freehand";
import getStroke from "perfect-freehand";
import { requirePenBrushDefinition } from "./penBrushes";
import type { PenShape } from "./shapes/penShape";

const DEFAULT_PEN_STROKE_OPTIONS = {
  smoothing: 0.6,
  streamline: 0.4,
  thinning: 0.6,
} satisfies Partial<FreehandStrokeOptions>;

export interface PenStrokeRenderOptions {
  last?: boolean;
}

export function getPenStrokeOptions(
  shape: PenShape,
  renderOptions: PenStrokeRenderOptions = {},
): FreehandStrokeOptions | null {
  const size = shape.style?.stroke?.size;
  if (!size) {
    return null;
  }
  const hasPressure = hasAlignedPressureSamples(shape);
  return {
    size,
    simulatePressure: !hasPressure,
    last: renderOptions.last ?? true,
    ...DEFAULT_PEN_STROKE_OPTIONS,
  };
}

export function getPenStrokeOutline(
  shape: PenShape,
  renderOptions: PenStrokeRenderOptions = {},
): Vec2Tuple[] {
  if (!shape.geometry.points.length) {
    return [];
  }
  const options = getPenStrokeOptions(shape, renderOptions);
  if (!options) {
    return [];
  }
  const outline = getStroke(
    getFreehandInputPoints(shape),
    options,
  ) as Vec2Tuple[];
  if (!outline.length) {
    return createDotStroke(shape.geometry.points[0], options);
  }
  return outline;
}

export function getPenStrokeBounds(
  shape: PenShape,
  renderOptions: PenStrokeRenderOptions = {},
): Box | null {
  const brushDefinition = requirePenBrushDefinition(
    shape.style?.stroke?.brushId,
  );
  if (brushDefinition.getBounds) {
    return brushDefinition.getBounds(shape);
  }
  const outline = getPenStrokeOutline(shape, renderOptions);
  if (!outline.length) {
    return null;
  }
  return BoxOperations.fromPointArray(outline);
}

export function getFreehandInputPoints(shape: PenShape): number[][] {
  const points = shape.geometry.points;
  const pressures = getAlignedPressures(shape);
  if (!pressures) {
    return points.map((point) => [getX(point), getY(point)]);
  }
  return points.map((point, index) => [
    getX(point),
    getY(point),
    pressures[index],
  ]);
}

function hasAlignedPressureSamples(shape: PenShape): boolean {
  return getAlignedPressures(shape) !== null;
}

function getAlignedPressures(shape: PenShape): number[] | null {
  const { points, pressures } = shape.geometry;
  if (!pressures || pressures.length !== points.length) {
    return null;
  }
  if (!pressures.every(isPressureSample)) {
    return null;
  }
  return pressures;
}

function isPressureSample(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
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
    toVec2Like(
      new Vec2()
        .add(center)
        .sub(delta)
        .add(new Vec2(2 * radius, 0)),
    ),
    toVec2Like(new Vec2().add(center).add(delta)),
    toVec2Like(
      new Vec2()
        .add(center)
        .add(delta)
        .sub(new Vec2(2 * radius, 0)),
    ),
  ];
}
