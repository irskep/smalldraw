import {
  computeSelectionBounds as computeSelectionBoundsForShapes,
  type DrawingStore,
} from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";

/**
 * Compute the bounding box of the current selection.
 */
export function computeSelectionBounds(store: DrawingStore): Box | null {
  const selection = store.getSelection();
  const ids = Array.from(selection.ids);
  if (!ids.length) {
    return null;
  }
  const doc = store.getDocument();
  const registry = store.getShapeHandlers();
  const shapes = ids.map((id) => doc.shapes[id]).filter((s) => !!s);
  const { bounds } = computeSelectionBoundsForShapes(shapes, registry);
  return bounds ?? null;
}
