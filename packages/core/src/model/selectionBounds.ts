import { type Box, BoxOperations } from "@smalldraw/geometry";
import { getShapeBounds } from "./geometryShapeUtils";
import type { AnyShape } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

export interface SelectionBoundsResult {
  bounds?: Box;
  shapeBounds: Map<string, Box>;
}

export function computeSelectionBounds(
  shapes: AnyShape[],
  registry: ShapeHandlerRegistry,
): SelectionBoundsResult {
  const shapeBoundsById = new Map<string, Box>();
  if (!shapes.length) {
    return { bounds: undefined, shapeBounds: shapeBoundsById };
  }
  const boundsList: Box[] = [];
  for (const shape of shapes) {
    const bounds = getShapeBounds(shape, registry);
    shapeBoundsById.set(shape.id, bounds);
    boundsList.push(bounds);
  }
  const selectionBounds = BoxOperations.fromPointArray(
    boundsList.flatMap((bounds) => [bounds.min, bounds.max]),
  );
  return {
    bounds: selectionBounds ?? undefined,
    shapeBounds: shapeBoundsById,
  };
}
