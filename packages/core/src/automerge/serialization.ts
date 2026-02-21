import { change, init } from "@automerge/automerge/slim";
import type {
  DrawingDocument,
  DrawingDocumentData,
  DrawingDocumentPresentation,
  DrawingDocumentSize,
} from "../model/document";
import {
  DEFAULT_DOCUMENT_PRESENTATION,
  DEFAULT_DOCUMENT_SIZE,
} from "../model/document";
import type { AnyShape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import type { ShapeHandlerRegistry } from "../model/shapeHandlers";

export interface DrawingDocumentJSON {
  size: DrawingDocumentSize;
  presentation?: DrawingDocumentPresentation;
  shapes: Record<string, AnyShape>;
  temporalOrderCounter?: number;
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
  return {
    size: doc.size,
    presentation: doc.presentation,
    shapes,
    temporalOrderCounter: doc.temporalOrderCounter,
  };
}

export function fromJSON(
  json: DrawingDocumentJSON,
  registry: ShapeHandlerRegistry,
): DrawingDocument {
  let doc = init<DrawingDocumentData>();
  doc = change(doc, (draft) => {
    draft.size = {
      width: Math.max(
        1,
        Math.round(json.size?.width ?? DEFAULT_DOCUMENT_SIZE.width),
      ),
      height: Math.max(
        1,
        Math.round(json.size?.height ?? DEFAULT_DOCUMENT_SIZE.height),
      ),
    };
    draft.presentation =
      json.presentation?.mode === "coloring" &&
      typeof json.presentation.coloringPageId === "string" &&
      json.presentation.coloringPageId.length > 0
        ? {
            mode: "coloring",
            coloringPageId: json.presentation.coloringPageId,
          }
        : DEFAULT_DOCUMENT_PRESENTATION;
    draft.shapes = {};
    draft.temporalOrderCounter = json.temporalOrderCounter ?? 0;
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
