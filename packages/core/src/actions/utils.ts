import type { DrawingDocument } from "../model/document";
import type { AnyShape } from "../model/shape";

export function requireShape(doc: DrawingDocument, shapeId: string): AnyShape {
  const shape = doc.shapes[shapeId];
  if (!shape) {
    throw new Error(`Shape ${shapeId} not found`);
  }
  return shape;
}
