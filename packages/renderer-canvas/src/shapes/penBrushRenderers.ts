import { getPenStrokeOutline, type PenShape } from "@smalldraw/core";
import type { Vec2Tuple } from "@smalldraw/geometry";
import { renderMarkerPath } from "./markerPath";
import { getSvgPathFromStroke } from "./penPath";

export interface PenBrushRenderContext {
  ctx: CanvasRenderingContext2D;
  shape: PenShape;
  points: Vec2Tuple[];
  strokeSize: number;
  color: string;
  isTemporary: boolean;
}

export type PenBrushRenderer = (context: PenBrushRenderContext) => void;

function renderFreehandPenBrush({
  ctx,
  shape,
  points,
  color,
  isTemporary,
}: PenBrushRenderContext): void {
  const outline = getPenStrokeOutline(
    {
      ...shape,
      geometry: {
        ...shape.geometry,
        points,
      },
    },
    { last: !isTemporary },
  );
  if (!outline.length) {
    return;
  }
  ctx.fillStyle = color;
  const pathData = getSvgPathFromStroke(outline);
  if (pathData && typeof Path2D !== "undefined") {
    ctx.fill(new Path2D(pathData));
    return;
  }
  ctx.beginPath();
  const [first, ...rest] = outline;
  if (!first) {
    return;
  }
  ctx.moveTo(first[0], first[1]);
  for (const [x, y] of rest) {
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

const PEN_BRUSH_RENDERERS = new Map<string, PenBrushRenderer>([
  ["freehand", renderFreehandPenBrush],
  [
    "marker",
    ({ ctx, points, strokeSize }) => {
      renderMarkerPath(ctx, points, strokeSize);
    },
  ],
]);

export function requirePenBrushRenderer(brushId: string | undefined): PenBrushRenderer {
  if (!brushId) {
    throw new Error("Pen stroke brushId is required but was missing.");
  }
  const renderer = PEN_BRUSH_RENDERERS.get(brushId);
  if (!renderer) {
    throw new Error(`Unknown pen brushId '${brushId}'.`);
  }
  return renderer;
}
