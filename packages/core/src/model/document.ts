import { change, init, type Doc } from "@automerge/automerge/slim";
import type { AnyShape } from "./shape";
import { canonicalizeShape } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

export interface DrawingDocumentData {
  shapes: Record<string, AnyShape>;
}

export type DrawingDocument = Doc<DrawingDocumentData>;

export function createDocument(
  initialShapes: AnyShape[] | undefined,
  registry: ShapeHandlerRegistry,
): DrawingDocument {
  let doc = init<DrawingDocumentData>();
  doc = change(doc, (draft) => {
    draft.shapes = {};
    if (initialShapes) {
      for (const shape of initialShapes) {
        const canonical = canonicalizeShape(shape, registry);
        draft.shapes[canonical.id] = canonical;
      }
    }
  });
  return doc;
}
