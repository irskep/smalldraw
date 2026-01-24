import {
  type Bounds,
  type DrawingStore,
  getShapeBounds,
  mergeBounds,
  type Point,
} from "@smalldraw/core";

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
 * Calculate distance between two points.
 */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
