import type { Point } from "@smalldraw/geometry";
import { containsPoint } from "@smalldraw/geometry";
import { getShapeBounds } from "./geometryShapeUtils";
import type { Shape } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

/**
 * Test if a world-space point hits a shape
 * Falls back to AABB test if no specific hit test is provided
 */
export function hitTestShape(
  shape: Shape,
  point: Point,
  registry: ShapeHandlerRegistry,
): boolean {
  const ops = registry.get(shape.type)?.shape;
  const shapeWithGeometry = shape as Shape & { geometry: unknown };

  // Use specific hit test if available
  if (ops?.hitTest) {
    return ops.hitTest(shapeWithGeometry, point);
  }

  // Fallback to AABB test
  const bounds = getShapeBounds(shape, registry);
  return containsPoint(bounds, point);
}

/**
 * Find the topmost shape at a point (back-to-front z-order)
 */
export function hitTestShapes(
  shapes: Shape[],
  point: Point,
  registry: ShapeHandlerRegistry,
): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (hitTestShape(shapes[i], point, registry)) {
      return shapes[i];
    }
  }
  return null;
}
