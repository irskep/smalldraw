import {
  computeSelectionBounds as computeSelectionBoundsForShapes,
  type Bounds,
  type DrawingStore,
  type Shape,
} from "@smalldraw/core";

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
  const registry = store.getShapeHandlers();
  const shapes = ids
    .map((id) => doc.shapes[id])
    .filter((shape): shape is Shape => Boolean(shape));
  const { bounds } = computeSelectionBoundsForShapes(shapes, registry);
  return bounds ?? null;
}
