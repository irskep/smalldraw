import { generateKeyBetween } from "jittered-fractional-indexing";
import { filterShapesAfterClear } from "./model/clear";
import {
  DEFAULT_LAYER_ID,
  type DrawingDocument,
  type DrawingLayer,
  normalizeDocumentLayers,
} from "./model/document";
import type { AnyShape } from "./model/shape";

export function getOrderedLayers(doc: DrawingDocument): DrawingLayer[] {
  const layers = normalizeDocumentLayers(doc.layers, doc.presentation);
  return Object.values(layers).sort((a, b) => {
    if (a.zIndex === b.zIndex) return 0;
    return a.zIndex < b.zIndex ? -1 : 1;
  });
}

export function getOrderedShapes(doc: DrawingDocument): AnyShape[] {
  const ordered = Object.values(doc.shapes).sort((a, b) => {
    if (a.zIndex === b.zIndex) return 0;
    return a.zIndex < b.zIndex ? -1 : 1;
  });
  return filterShapesAfterClear(ordered) as AnyShape[];
}

export function getShapesInLayer(
  doc: DrawingDocument,
  layerId: string,
): AnyShape[] {
  return getOrderedShapes(doc).filter((shape) => shape.layerId === layerId);
}

export function getTopZIndex(doc: DrawingDocument): string {
  const ordered = getOrderedShapes(doc);
  if (!ordered.length) {
    return generateKeyBetween(null, null);
  }
  return ordered[ordered.length - 1].zIndex;
}

export function getTopZIndexInLayer(
  doc: DrawingDocument,
  layerId: string,
): string | null {
  // Cleared shapes can reappear on undo. Reserve their positions so newer
  // drawing stays above them even if the clear is undone during a draft.
  let top: string | null = null;
  for (const shape of Object.values(doc.shapes)) {
    if ((shape.layerId ?? DEFAULT_LAYER_ID) !== layerId) continue;
    if (top === null || shape.zIndex > top) top = shape.zIndex;
  }
  return top;
}

export function getZIndexBetween(
  before: string | null,
  after: string | null,
): string {
  return generateKeyBetween(before, after);
}
