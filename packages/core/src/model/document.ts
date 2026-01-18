import type { Shape } from './shape';
import { canonicalizeShape } from './shape';
import type { ShapeHandlerRegistry } from './shapeHandlers';

export interface DrawingDocument {
  shapes: Record<string, Shape>;
}

export function createDocument(
  initialShapes: Shape[] | undefined,
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
