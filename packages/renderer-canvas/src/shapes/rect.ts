import type { AnyShape } from "@smalldraw/core";
import { getX, getY } from "@smalldraw/geometry";
import { applyFill, applyStroke } from "../style";

export function renderRect(
  ctx: CanvasRenderingContext2D,
  shape: AnyShape & { geometry: { type: "rect"; size: [number, number] } },
): void {
  const width = getX(shape.geometry.size);
  const height = getY(shape.geometry.size);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-width / 2, -height / 2, width, height);
  applyFill(ctx, shape);
  applyStroke(ctx, shape.style.stroke);
  ctx.restore();
}
