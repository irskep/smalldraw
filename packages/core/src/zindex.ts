import { generateKeyBetween } from "jittered-fractional-indexing";
import { filterShapesAfterClear } from "./model/clear";
import {
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
  const layerShapes = getShapesInLayer(doc, layerId);
  if (!layerShapes.length) {
    return null;
  }
  return layerShapes[layerShapes.length - 1].zIndex;
}

export function getZIndexBetween(
  before: string | null,
  after: string | null,
): string {
  return generateKeyBetween(before, after);
}
