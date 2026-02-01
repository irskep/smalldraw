import type { Vec2 } from "@smalldraw/geometry";
import type { AnyShape, Shape } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

/**
 * Test if a world-space point hits a shape
 * Requires a shape-specific hit test implementation
 */
export function hitTestShape(
  shape: AnyShape,
  point: Vec2,
  registry: ShapeHandlerRegistry,
): boolean {
  const ops = registry.get(shape.type)?.shape;
  if (!ops?.hitTest) {
    return false;
  }
  return ops.hitTest(shape, point);
}

/**
 * Find the topmost shape at a point (back-to-front z-order)
 */
export function hitTestShapes(
  shapes: AnyShape[],
  point: Vec2,
  registry: ShapeHandlerRegistry,
): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (hitTestShape(shapes[i], point, registry)) {
      return shapes[i];
    }
  }
  return null;
}
