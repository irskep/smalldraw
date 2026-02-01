import type { Vec2Like } from "@smalldraw/geometry";
import { getX, getY } from "@smalldraw/geometry";
import type { StrokeOptions as FreehandStrokeOptions } from "perfect-freehand";
import getStroke from "perfect-freehand";

export type StrokePathOptions = FreehandStrokeOptions;

export interface StrokePolygonResult {
  points: number[][];
  flatPoints: number[];
  path: string;
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
    return createDotStroke(points[0], options);
  }
  const flatPoints = flattenOutline(outline);
  return {
    points: outline,
    flatPoints,
    path: outlineToPath(outline),
  };
}

export function flattenOutline(outline: number[][]): number[] {
  const flattened: number[] = [];
  for (const [x, y] of outline) {
    flattened.push(x, y);
  }
  return flattened;
}

export function outlineToPath(outline: number[][]): string {
  if (!outline.length) {
    return "";
  }
  const commands: string[] = [];
  for (let i = 0; i < outline.length; i += 1) {
    const [x, y] = outline[i];
    commands.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

function createDotStroke(
  point: Vec2Like,
  options?: StrokePathOptions,
): StrokePolygonResult {
  const radius = Math.max(1, (options?.size ?? 1) / 2);
  const outline: number[][] = [
    [getX(point) - radius, getY(point) - radius],
    [getX(point) + radius, getY(point) - radius],
    [getX(point) + radius, getY(point) + radius],
    [getX(point) - radius, getY(point) + radius],
  ];
  const flatPoints = flattenOutline(outline);
  return {
    points: outline,
    flatPoints,
    path: outlineToPath(outline),
  };
}
