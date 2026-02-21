import { change, type Doc, init } from "@automerge/automerge/slim";
import type { ActionContext, UndoableAction } from "../actions";
import type { AnyShape } from "./shape";
import { canonicalizeShape } from "./shape";
import type { ShapeHandlerRegistry } from "./shapeHandlers";

export interface DrawingDocumentSize {
  width: number;
  height: number;
}

export type DrawingDocumentPresentation =
  | {
      mode: "normal";
    }
  | {
      mode: "coloring";
      coloringPageId: string;
    };

export const DEFAULT_DOCUMENT_SIZE: DrawingDocumentSize = {
  width: 960,
  height: 600,
};

export const DEFAULT_DOCUMENT_PRESENTATION: DrawingDocumentPresentation = {
  mode: "normal",
};

function normalizePresentation(
  presentation: DrawingDocumentPresentation | undefined,
): DrawingDocumentPresentation {
  if (
    presentation?.mode === "coloring" &&
    typeof presentation.coloringPageId === "string" &&
    presentation.coloringPageId.length > 0
  ) {
    return {
      mode: "coloring",
      coloringPageId: presentation.coloringPageId,
    };
  }
  return {
    mode: "normal",
  };
}

export interface DrawingDocumentData {
  size: DrawingDocumentSize;
  presentation: DrawingDocumentPresentation;
  shapes: Record<string, AnyShape>;
  temporalOrderCounter: number;
}

export type DrawingDocument = Doc<DrawingDocumentData>;

export function createDocument(
  initialShapes: AnyShape[] | undefined,
  registry: ShapeHandlerRegistry,
  size: DrawingDocumentSize = DEFAULT_DOCUMENT_SIZE,
  presentation: DrawingDocumentPresentation = DEFAULT_DOCUMENT_PRESENTATION,
): DrawingDocument {
  let doc = init<DrawingDocumentData>();
  doc = change(doc, (draft) => {
    draft.size = {
      width: Math.max(1, Math.round(size.width)),
      height: Math.max(1, Math.round(size.height)),
    };
    draft.presentation = normalizePresentation(presentation);
    draft.shapes = {};
    let maxTemporalOrder = -1;
    if (initialShapes) {
      for (const shape of initialShapes) {
        const canonical = canonicalizeShape(shape, registry);
        if (typeof canonical.temporalOrder === "number") {
          maxTemporalOrder = Math.max(
            maxTemporalOrder,
            canonical.temporalOrder,
          );
        }
        draft.shapes[canonical.id] = canonical;
      }
    }
    draft.temporalOrderCounter = maxTemporalOrder + 1;
  });
  return doc;
}

export function applyActionToDoc(
  doc: DrawingDocument,
  action: UndoableAction,
  registry: ShapeHandlerRegistry,
  changeFn?: ActionContext["change"],
): DrawingDocument {
  const ctx: ActionContext = {
    registry,
    change: changeFn ?? ((nextDoc, update) => change(nextDoc, update)),
  };
  return action.redo(doc, ctx);
}
