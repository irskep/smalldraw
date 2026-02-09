import type { Box } from "@smalldraw/geometry";
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
