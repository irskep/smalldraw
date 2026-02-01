import { getX, getY } from "@smalldraw/geometry";
import type { Vec2Like } from "gl-matrix";
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
  if (outline.length < 4) {
    return "";
  }
  const average = (a: number, b: number) => (a + b) / 2;
  let a = outline[0];
  let b = outline[1];
  const c = outline[2];
  let result = `M${a[0]},${a[1]} Q${b[0]},${b[1]} ${average(
    b[0],
    c[0],
  )},${average(b[1], c[1])} T`;
  for (let i = 2, max = outline.length - 1; i < max; i += 1) {
    a = outline[i];
    b = outline[i + 1];
    result += `${average(a[0], b[0])},${average(a[1], b[1])} `;
  }
  result += "Z";
  return result;
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
