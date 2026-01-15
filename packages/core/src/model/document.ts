import type { Shape } from './shape';
import { canonicalizeShape } from './shape';

export interface DrawingDocument {
  shapes: Record<string, Shape>;
}

export function createDocument(initialShapes?: Shape[]): DrawingDocument {
  const doc: DrawingDocument = { shapes: {} };
  if (initialShapes) {
    for (const shape of initialShapes) {
      doc.shapes[shape.id] = canonicalizeShape(shape);
    }
  }
  return doc;
}
