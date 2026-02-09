import { type Box, BoxOperations, type Vec2Tuple } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import type { PenShape } from "./shapes/penShape";

export const DEFAULT_MARKER_SMOOTHING_ORDER = 3;

export function smoothMarkerPoints(
  points: Vec2Tuple[],
  order = DEFAULT_MARKER_SMOOTHING_ORDER,
): Vec2Tuple[] {
  if (!points.length || order <= 0) {
    return points;
  }
  return bspline(points, order);
}

export function getMarkerStrokeBounds(shape: PenShape): Box | null {
  const points = smoothMarkerPoints(shape.geometry.points);
  const bounds = BoxOperations.fromPointArray(
    points.length ? points : shape.geometry.points,
  );
  if (!bounds) {
    return null;
  }
  const strokeSize = Math.max(1, shape.style.stroke?.size ?? 1);
  const padding = strokeSize / 2;
  return BoxOperations.fromPointPair(
    new Vec2(bounds.min).sub([padding, padding]),
    new Vec2(bounds.max).add([padding, padding]),
  );
}

function bspline(points: Vec2Tuple[], order: number): Vec2Tuple[] {
  if (order <= 0) {
    return points;
  }
  return bspline(dual(dual(refine(points))), order - 1);
}

function refine(points: Vec2Tuple[]): Vec2Tuple[] {
  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) {
    return points;
  }
  const padded = [start, ...points, end];
  const refined: Vec2Tuple[] = [];
  for (let i = 0; i < padded.length; i += 1) {
    const point = padded[i];
    refined.push(point);
    const next = padded[i + 1];
    if (next) {
      refined.push(midpoint(point, next));
    }
  }
  return refined;
}

function dual(points: Vec2Tuple[]): Vec2Tuple[] {
  const dualPoints: Vec2Tuple[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    dualPoints.push(midpoint(points[i], points[i + 1]));
  }
  return dualPoints;
}

function midpoint(a: Vec2Tuple, b: Vec2Tuple): Vec2Tuple {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
