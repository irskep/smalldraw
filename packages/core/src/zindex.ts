import { generateKeyBetween } from "jittered-fractional-indexing";

import type { DrawingDocument } from "./model/document";
import type { AnyShape } from "./model/shape";

export function getOrderedShapes(doc: DrawingDocument): AnyShape[] {
  return Object.values(doc.shapes).sort((a, b) => {
    if (a.zIndex === b.zIndex) return 0;
    return a.zIndex < b.zIndex ? -1 : 1;
  });
}

export function getTopZIndex(doc: DrawingDocument): string {
  const ordered = getOrderedShapes(doc);
  if (!ordered.length) {
    return generateKeyBetween(null, null);
  }
  return ordered[ordered.length - 1].zIndex;
}

export function getZIndexBetween(
  before: string | null,
  after: string | null,
): string {
  return generateKeyBetween(before, after);
}
