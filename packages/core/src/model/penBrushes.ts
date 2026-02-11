import { type Box, BoxOperations, getX, getY } from "@smalldraw/geometry";
import { getMarkerStrokeBounds } from "./markerSmoothing";
import type { PenShape } from "./shapes/penShape";

export type PenBrushBoundsResolver = (shape: PenShape) => Box | null;

export interface PenBrushDefinition {
  id: string;
  getBounds?: PenBrushBoundsResolver;
}

const PEN_BRUSH_REGISTRY = new Map<string, PenBrushDefinition>([
  [
    "freehand",
    {
      id: "freehand",
    },
  ],
  [
    "marker",
    {
      id: "marker",
      getBounds: getMarkerStrokeBounds,
    },
  ],
  [
    "spray",
    {
      id: "spray",
      getBounds: getSprayStrokeBounds,
    },
  ],
]);

export function requirePenBrushDefinition(
  brushId: string | undefined,
): PenBrushDefinition {
  if (!brushId) {
    throw new Error("Pen stroke brushId is required but was missing.");
  }
  const definition = PEN_BRUSH_REGISTRY.get(brushId);
  if (!definition) {
    throw new Error(`Unknown pen brushId '${brushId}'.`);
  }
  return definition;
}

function getSprayStrokeBounds(shape: PenShape): Box | null {
  const pointBounds = BoxOperations.fromPointArray(shape.geometry.points);
  if (!pointBounds) {
    return null;
  }
  const strokeSize = Math.max(1, shape.style.stroke?.size ?? 1);
  const radius = Math.max(2, strokeSize * 1.6);
  return {
    min: [getX(pointBounds.min) - radius, getY(pointBounds.min) - radius],
    max: [getX(pointBounds.max) + radius, getY(pointBounds.max) + radius],
  };
}
