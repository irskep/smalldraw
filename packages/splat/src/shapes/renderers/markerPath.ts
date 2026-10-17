import { smoothMarkerPoints, smoothMarkerTail } from "@smalldraw/core";
import type { Vec2Tuple } from "@smalldraw/geometry";

const MARKER_CURVE_TENSION = 1;

// One preview path per scratch context, released with that context. Never split
// the actual stroke into separately painted pieces: opacity and joins depend on it.
const previewPaths = new WeakMap<
  CanvasRenderingContext2D,
  {
    input: Vec2Tuple[];
    prefix: Path2D;
    stableSegments: number;
    complete: Path2D | null;
  }
>();

export function renderMarkerPath(
  ctx: CanvasRenderingContext2D,
  points: Vec2Tuple[],
  strokeSize: number,
  incrementalPreview = false,
): void {
  if (!points.length) {
    return;
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = strokeSize;
  if (incrementalPreview && typeof Path2D === "function") {
    let state = previewPaths.get(ctx);
    if (!state) {
      state = {
        input: [],
        prefix: new Path2D(),
        stableSegments: 0,
        complete: null,
      };
      previewPaths.set(ctx, state);
    }
    let reset = points.length < state.input.length;
    for (let i = 0; !reset && i < state.input.length; i++) {
      reset =
        points[i][0] !== state.input[i][0] ||
        points[i][1] !== state.input[i][1];
    }
    if (reset) {
      state.input.length = 0;
      state.complete = null;
    }
    if (points.length !== state.input.length || !state.complete) {
      const tail = smoothMarkerTail(points, state.input.length);
      if (!state.complete) {
        state.prefix = new Path2D();
        state.prefix.moveTo(tail.points[0][0], tail.points[0][1]);
        state.stableSegments = 0;
      }
      // A cubic uses p0..p3. Only append curves whose next neighbour is stable.
      const stableSegments = Math.max(0, tail.stableCount - 2);
      appendCurves(
        state.prefix,
        tail.points,
        state.stableSegments - tail.offset,
        stableSegments - tail.offset,
      );
      state.stableSegments = stableSegments;
      state.complete = new Path2D(state.prefix);
      appendCurves(
        state.complete,
        tail.points,
        stableSegments - tail.offset,
        tail.points.length - 1,
      );
      for (let i = state.input.length; i < points.length; i++)
        state.input.push([points[i][0], points[i][1]]);
    }
    ctx.beginPath();
    if (state.complete) ctx.stroke(state.complete);
    return;
  }
  previewPaths.delete(ctx);
  const smoothed = smoothMarkerPoints(points);
  const drawPoints = smoothed.length ? smoothed : points;
  const first = drawPoints[0];
  if (!first) {
    return;
  }
  ctx.beginPath();
  if (drawPoints.length === 1) {
    ctx.fillStyle = ctx.strokeStyle;
    ctx.arc(first[0], first[1], Math.max(1, strokeSize / 2), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(first[0], first[1]);
  if (drawPoints.length === 2) {
    const second = drawPoints[1];
    if (second) {
      ctx.lineTo(second[0], second[1]);
    }
    ctx.stroke();
    return;
  }

  appendCurves(ctx, drawPoints, 0, drawPoints.length - 1);
  ctx.stroke();
}

function appendCurves(
  path: Pick<CanvasRenderingContext2D, "bezierCurveTo">,
  drawPoints: Vec2Tuple[],
  start: number,
  end: number,
): void {
  for (let i = start; i < end; i += 1) {
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
    path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
  }
}
