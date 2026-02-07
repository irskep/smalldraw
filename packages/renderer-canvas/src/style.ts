import type { AnyShape, StrokeStyle } from "@smalldraw/core";

export function applyStroke(
  ctx: CanvasRenderingContext2D,
  stroke?: StrokeStyle,
): void {
  if (!stroke) return;
  ctx.save();
  ctx.globalCompositeOperation = stroke.compositeOp ?? "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

export function applyFill(
  ctx: CanvasRenderingContext2D,
  shape: AnyShape,
): void {
  const fill = shape.style.fill;
  if (!fill) return;
  if (fill.type === "solid") {
    ctx.fillStyle = fill.color;
    ctx.fill();
  }
}
