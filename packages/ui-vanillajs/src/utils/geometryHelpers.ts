import {
  DrawingStore,
  getShapeBounds,
  applyTransformToPoint,
  mergeBounds,
  type Bounds,
  type Point,
  type RectGeometry,
  type Shape,
} from "@smalldraw/core";

type ShapeWithGeometry = Shape & { geometry: RectGeometry };

// Re-export mergeBounds for convenience
export { mergeBounds };

/**
 * Compute the bounding box of the current selection.
 */
export function computeSelectionBounds(store: DrawingStore): Bounds | null {
  const selection = store.getSelection();
  const ids = Array.from(selection.ids);
  if (!ids.length) {
    return null;
  }
  const doc = store.getDocument();
  let result: Bounds | null = null;
  const registry = store.getShapeHandlers();
  for (const id of ids) {
    const shape = doc.shapes[id];
    if (!shape) continue;
    const bounds = getShapeBounds(shape, registry);
    result = result ? mergeBounds(result, bounds) : bounds;
  }
  return result;
}

/**
 * Resolve handle point from bounds or shape-specific logic.
 */
export function resolveHandlePoint(
  bounds: Bounds,
  handle: {
    id: string;
    position: { u: number; v: number };
    behavior?: { type?: string; axis?: string };
  },
  shape?: Shape,
): Point {
  const shapeWithGeom = shape as ShapeWithGeometry | undefined;
  if (
    handle.behavior?.type === "resize-axis" &&
    shapeWithGeom?.geometry.type === "rect"
  ) {
    const point = resolveAxisHandlePoint(handle.id, shapeWithGeom);
    if (point) return point;
  }
  return {
    x: bounds.minX + bounds.width * handle.position.u,
    y: bounds.minY + bounds.height * handle.position.v,
  };
}

/**
 * Resolve position for axis handles on rectangles.
 */
export function resolveAxisHandlePoint(handleId: string, shape: ShapeWithGeometry): Point | null {
  if (shape.geometry.type !== "rect") return null;
  const rectGeometry = shape.geometry;
  const halfWidth = rectGeometry.size.width / 2;
  const halfHeight = rectGeometry.size.height / 2;
  let local: Point | null = null;
  switch (handleId) {
    case "mid-right":
      local = { x: halfWidth, y: 0 };
      break;
    case "mid-left":
      local = { x: -halfWidth, y: 0 };
      break;
    case "mid-top":
      local = { x: 0, y: -halfHeight };
      break;
    case "mid-bottom":
      local = { x: 0, y: halfHeight };
      break;
    default:
      return null;
  }
  const world = applyTransformToPoint(local, shape.transform);
  return world;
}

/**
 * Calculate distance between two points.
 */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

