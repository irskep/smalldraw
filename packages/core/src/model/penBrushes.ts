import { type Box, BoxOperations, getX, getY } from "@smalldraw/geometry";
import { smoothMarkerPoints } from "./markerSmoothing";
import { getPenGeometryPoints, type PenShape } from "./shapes/penShape";

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
      getBounds: getMarkerBrushStrokeBounds,
    },
  ],
  [
    "even-spraycan",
    {
      id: "even-spraycan",
      getBounds: getSpraycanStrokeBounds,
    },
  ],
  [
    "uneven-spraycan",
    {
      id: "uneven-spraycan",
      getBounds: getSpraycanStrokeBounds,
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

function getSpraycanStrokeBounds(shape: PenShape): Box | null {
  const pointBounds = BoxOperations.fromPointArray(
    getPenGeometryPoints(shape.geometry),
  );
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

function getMarkerBrushStrokeBounds(shape: PenShape): Box | null {
  const inputPoints = getPenGeometryPoints(shape.geometry);
  const points = smoothMarkerPoints(inputPoints);
  const bounds = BoxOperations.fromPointArray(
    points.length ? points : inputPoints,
  );
  if (!bounds) {
    return null;
  }
  const strokeSize = Math.max(1, shape.style.stroke?.size ?? 1);
  const padding = strokeSize / 2;
  return {
    min: [getX(bounds.min) - padding, getY(bounds.min) - padding],
    max: [getX(bounds.max) + padding, getY(bounds.max) + padding],
  };
}
