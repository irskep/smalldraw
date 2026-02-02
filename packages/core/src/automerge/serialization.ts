import type { DrawingDocument, DrawingDocumentData } from "../model/document";
import { change, init } from "@automerge/automerge/slim";
import type { AnyShape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import type { ShapeHandlerRegistry } from "../model/shapeHandlers";

export interface DrawingDocumentJSON {
  shapes: Record<string, AnyShape>;
}

export function toJSON(
  doc: DrawingDocument,
  registry: ShapeHandlerRegistry,
): DrawingDocumentJSON {
  const shapes: Record<string, AnyShape> = {};
  for (const shape of Object.values(doc.shapes)) {
    const handler = registry.get(shape.type);
    if (!handler?.serialization?.toJSON) {
      throw new Error(`Missing serializer for shape type "${shape.type}"`);
    }
    const serialized = handler.serialization.toJSON(shape);
    shapes[serialized.id] = serialized;
  }
  return { shapes };
}

export function fromJSON(
  json: DrawingDocumentJSON,
  registry: ShapeHandlerRegistry,
): DrawingDocument {
  let doc = init<DrawingDocumentData>();
  doc = change(doc, (draft) => {
    draft.shapes = {};
    for (const shape of Object.values(json.shapes)) {
      const handler = registry.get(shape.type);
      if (!handler?.serialization?.fromJSON) {
        throw new Error(`Missing deserializer for shape type "${shape.type}"`);
      }
      const hydrated = handler.serialization.fromJSON(shape);
      const canonical = canonicalizeShape(hydrated, registry);
      draft.shapes[canonical.id] = canonical;
    }
  });
  return doc;
}
