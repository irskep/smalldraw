import type { Shape } from "./shape";
import type { Point } from "./primitives";
import type { ShapeHandlerRegistry } from "./shapeHandlers";
import { getShapeBounds } from "./geometryBounds";

/**
 * Test if a world-space point hits a shape
 * Falls back to AABB test if no specific hit test is provided
 */
export function hitTestShape(
  shape: Shape,
  point: Point,
  registry: ShapeHandlerRegistry,
): boolean {
  const ops = registry.getShapeOps(shape.geometry.type);

  // Use specific hit test if available
  if (ops?.hitTest) {
    return ops.hitTest(shape as any, point);
  }

  // Fallback to AABB test
  const bounds = getShapeBounds(shape, registry);
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
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
