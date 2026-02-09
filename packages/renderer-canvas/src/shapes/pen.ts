import { toVec2, toVec2Like } from "@smalldraw/geometry";
import type { PenShape, Shape } from "@smalldraw/core";
import { getPenStrokeOutline } from "@smalldraw/core";
import { getSvgPathFromStroke } from "./penPath";

export function renderPen(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (shape.type !== "pen") {
    return;
  }
  const isTemporary =
    (shape as { temporary?: boolean }).temporary === true;
  const penShape = shape as PenShape;
  const stroke = penShape.style.stroke;
  const color = stroke?.color ?? "#000000";
  const points = penShape.geometry.points.map((point) =>
    toVec2Like(toVec2(point)),
  );
  const outline = getPenStrokeOutline({
    ...penShape,
    geometry: {
      ...penShape.geometry,
      points,
    },
  }, { last: !isTemporary });
  if (!outline.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = stroke?.compositeOp ?? "source-over";
  ctx.fillStyle = color;
  const pathData = getSvgPathFromStroke(outline);
  if (pathData && typeof Path2D !== "undefined") {
    ctx.fill(new Path2D(pathData));
  } else {
    ctx.beginPath();
    const [first, ...rest] = outline;
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
  }
  ctx.restore();
}
