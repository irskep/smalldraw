import { getX, getY } from "@smalldraw/geometry";
import type { Vec2Like } from "gl-matrix";
import type { StrokeOptions as FreehandStrokeOptions } from "perfect-freehand";
import getStroke from "perfect-freehand";

export type StrokePathOptions = FreehandStrokeOptions;

export interface StrokePolygonResult {
  points: number[][];
}

export function createFreehandStroke(
  points: Vec2Like[],
  options?: StrokePathOptions,
): StrokePolygonResult | null {
  if (!points.length) {
    return null;
  }
  const outline = getStroke(
    points.map((point) => [getX(point), getY(point)]),
    options ?? {},
  );
  if (!outline.length) {
    return { points: createDotStroke(points[0], options) };
  }
  return { points: outline };
}

function createDotStroke(
  point: Vec2Like,
  options?: StrokePathOptions,
): number[][] {
  const radius = Math.max(1, (options?.size ?? 1) / 2);
  return [
    [getX(point) - radius, getY(point) - radius],
    [getX(point) + radius, getY(point) - radius],
    [getX(point) + radius, getY(point) + radius],
    [getX(point) - radius, getY(point) + radius],
  ];
}
