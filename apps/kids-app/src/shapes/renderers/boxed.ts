import type { AnyShape } from "@smalldraw/core";
import { getX, getY } from "@smalldraw/geometry";
import { applyFill, applyStroke } from "./style";

export function renderBoxed(
  ctx: CanvasRenderingContext2D,
  shape: AnyShape & {
    geometry: {
      type: "boxed";
      kind: "rect" | "ellipse";
      size: [number, number];
    };
  },
): void {
  const width = getX(shape.geometry.size);
  const height = getY(shape.geometry.size);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  ctx.save();
  ctx.beginPath();
  if (shape.geometry.kind === "ellipse") {
    ctx.ellipse(0, 0, halfWidth, halfHeight, 0, 0, Math.PI * 2);
  } else {
    ctx.rect(-halfWidth, -halfHeight, width, height);
  }
  applyFill(ctx, shape);
  applyStroke(ctx, shape.style.stroke);
  ctx.restore();
}
