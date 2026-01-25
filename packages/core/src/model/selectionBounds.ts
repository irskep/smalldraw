import type { Bounds } from "@smalldraw/geometry";
import { getBoundsFromPoints } from "@smalldraw/geometry";
import { getShapeBounds } from "./geometryShapeUtils";
import type { Shape } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

export interface SelectionBoundsResult {
  bounds?: Bounds;
  shapeBounds: Map<string, Bounds>;
}

export function computeSelectionBounds(
  shapes: Shape[],
  registry: ShapeHandlerRegistry,
): SelectionBoundsResult {
  const shapeBoundsById = new Map<string, Bounds>();
  if (!shapes.length) {
    return { bounds: undefined, shapeBounds: shapeBoundsById };
  }
  const boundsList: Bounds[] = [];
  for (const shape of shapes) {
    const bounds = getShapeBounds(shape, registry);
    shapeBoundsById.set(shape.id, bounds);
    boundsList.push(bounds);
  }
  const selectionBounds = getBoundsFromPoints(
    boundsList.flatMap((bounds) => [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
    ]),
  );
  return {
    bounds: selectionBounds ?? undefined,
    shapeBounds: shapeBoundsById,
  };
}
