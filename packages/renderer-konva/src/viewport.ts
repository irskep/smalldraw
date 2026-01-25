import type { Point } from "@smalldraw/geometry";
import type { Layer } from "konva/lib/Layer.js";
import type { Stage } from "konva/lib/Stage.js";

export interface Viewport {
  width: number;
  height: number;
  center: Point;
  scale: number;
  backgroundColor?: string;
}

export const DEFAULT_BACKGROUND_COLOR = "#ffffff";

export function applyViewportToStage(
  stage: Stage,
  layer: Layer,
  viewport: Viewport,
): void {
  stage.width(viewport.width);
  stage.height(viewport.height);
  layer.scale({ x: viewport.scale, y: viewport.scale });
  layer.position(getLayerPositionForViewport(viewport));
}

function getLayerPositionForViewport(viewport: Viewport): {
  x: number;
  y: number;
} {
  return {
    x: viewport.width / 2 - viewport.center.x * viewport.scale,
    y: viewport.height / 2 - viewport.center.y * viewport.scale,
  };
}
