import type { Vec2 } from "@smalldraw/geometry";
import { getX, getY } from "@smalldraw/geometry";

export interface Viewport {
  width: number;
  height: number;
  center: Vec2;
  scale: number;
}

export function applyViewportToContext(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
): void {
  const scale = viewport.scale;
  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    viewport.width / 2 - getX(viewport.center) * scale,
    viewport.height / 2 - getY(viewport.center) * scale,
  );
}
