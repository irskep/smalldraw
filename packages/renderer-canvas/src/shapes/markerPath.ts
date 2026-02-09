import type { Vec2Tuple } from "@smalldraw/geometry";
import { smoothMarkerPoints } from "@smalldraw/core";

const MARKER_CURVE_TENSION = 1;

export function renderMarkerPath(
  ctx: CanvasRenderingContext2D,
  points: Vec2Tuple[],
  strokeSize: number,
): void {
  if (!points.length) {
    return;
  }
  const smoothed = smoothMarkerPoints(points);
  const drawPoints = smoothed.length ? smoothed : points;
  const [first, ...rest] = drawPoints;
  if (!first) {
    return;
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = strokeSize;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  if (drawPoints.length === 1) {
    ctx.lineTo(first[0], first[1]);
    ctx.stroke();
    return;
  }
  if (drawPoints.length === 2) {
    const second = drawPoints[1];
    if (second) {
      ctx.lineTo(second[0], second[1]);
    }
    ctx.stroke();
    return;
  }

  for (let i = 0; i < rest.length; i += 1) {
    const p1 = drawPoints[i];
    const p2 = drawPoints[i + 1];
    if (!p1 || !p2) {
      continue;
    }
    const p0 = drawPoints[i - 1] ?? p1;
    const p3 = drawPoints[i + 2] ?? p2;
    const cp1x = p1[0] + ((p2[0] - p0[0]) / 6) * MARKER_CURVE_TENSION;
    const cp1y = p1[1] + ((p2[1] - p0[1]) / 6) * MARKER_CURVE_TENSION;
    const cp2x = p2[0] - ((p3[0] - p1[0]) / 6) * MARKER_CURVE_TENSION;
    const cp2y = p2[1] - ((p3[1] - p1[1]) / 6) * MARKER_CURVE_TENSION;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
  }
  ctx.stroke();
}
