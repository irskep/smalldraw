import { change, init } from "@automerge/automerge/slim";
import type {
  DrawingDocument,
  DrawingDocumentData,
  DrawingDocumentPresentation,
  DrawingDocumentSize,
  DrawingLayer,
} from "../model/document";
import {
  DEFAULT_DOCUMENT_SIZE,
  normalizeDocumentLayers,
} from "../model/document";
import type { AnyShape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import type { ShapeHandlerRegistry } from "../model/shapeHandlers";

export interface DrawingDocumentJSON {
  size: DrawingDocumentSize;
  presentation?: DrawingDocumentPresentation;
  layers?: Record<string, DrawingLayer>;
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
    layers: doc.layers,
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
    if (
      json.presentation?.referenceImage &&
      typeof json.presentation.referenceImage.src === "string" &&
      json.presentation.referenceImage.src.length > 0 &&
      (json.presentation.referenceImage.composite === "under-drawing" ||
        json.presentation.referenceImage.composite === "over-drawing")
    ) {
      const documentType =
        typeof json.presentation.documentType === "string" &&
        json.presentation.documentType.trim().length > 0
          ? json.presentation.documentType
          : undefined;
      const nextPresentation: DrawingDocumentPresentation = {
        referenceImage: {
          src: json.presentation.referenceImage.src,
          composite: json.presentation.referenceImage.composite,
        },
      };
      if (documentType) {
        nextPresentation.documentType = documentType;
      }
      draft.presentation = nextPresentation;
    } else {
      const nextPresentation: DrawingDocumentPresentation = {};
      if (
        typeof json.presentation?.documentType === "string" &&
        json.presentation.documentType.trim().length > 0
      ) {
        nextPresentation.documentType = json.presentation.documentType;
      }
      draft.presentation = nextPresentation;
    }
    draft.layers = normalizeDocumentLayers(json.layers, draft.presentation);
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
