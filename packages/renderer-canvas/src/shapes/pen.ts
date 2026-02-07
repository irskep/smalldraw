import { toVec2, toVec2Like } from "@smalldraw/geometry";
import type { PenShape, Shape } from "@smalldraw/core";
import { createFreehandStroke } from "../stroke";

export function renderPen(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
): void {
  if (shape.type !== "pen") {
    return;
  }
  const penShape = shape as PenShape;
  const stroke = penShape.style.stroke;
  const color = stroke?.color ?? "#000000";
  const size = stroke?.size ?? 4;
  const points = penShape.geometry.points.map((point) =>
    toVec2Like(toVec2(point)),
  );
  const strokeResult = createFreehandStroke(points, {
    size,
    simulatePressure: !!penShape.geometry.pressures,
    smoothing: 0.6,
    streamline: 0.4,
    thinning: 0.6,
  });
  if (!strokeResult) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = stroke?.compositeOp ?? "source-over";
  ctx.fillStyle = color;
  ctx.beginPath();
  const [first, ...rest] = strokeResult.points;
  if (!first) {
    ctx.restore();
    return;
  }
  ctx.moveTo(first[0], first[1]);
  for (const [x, y] of rest) {
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
