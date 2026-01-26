import type { AnyShape } from "./shape";
import { canonicalizeShape } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

export interface DrawingDocument {
  shapes: Record<string, AnyShape>;
}

export function createDocument(
  initialShapes: AnyShape[] | undefined,
  registry: ShapeHandlerRegistry,
): DrawingDocument {
  const doc: DrawingDocument = { shapes: {} };
  if (initialShapes) {
    for (const shape of initialShapes) {
      doc.shapes[shape.id] = canonicalizeShape(shape, registry);
    }
  }
  return doc;
}
