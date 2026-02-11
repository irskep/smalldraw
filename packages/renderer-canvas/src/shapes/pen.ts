import { getPenGeometryPoints, type PenShape, type Shape } from "@smalldraw/core";
import { toVec2, toVec2Like } from "@smalldraw/geometry";
import { requirePenBrushRenderer } from "./penBrushRenderers";

export function renderPen(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (shape.type !== "pen") {
    return;
  }
  const isTemporary = (shape as { temporary?: boolean }).temporary === true;
  const penShape = shape as PenShape;
  const stroke = penShape.style.stroke;
  const color = stroke?.color ?? "#000000";
  const strokeSize = Math.max(1, stroke?.size ?? 1);
  const points = getPenGeometryPoints(penShape.geometry).map((point) =>
    toVec2Like(toVec2(point)),
  );
  if (!points.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = stroke?.compositeOp ?? "source-over";
  const brushRenderer = requirePenBrushRenderer(stroke?.brushId);
  ctx.strokeStyle = color;
  brushRenderer({
    ctx,
    shape: penShape,
    points,
    strokeSize,
    color,
    isTemporary,
  });
  ctx.restore();
}
