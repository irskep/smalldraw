import type { DrawingDocument, DrawingDocumentData } from "../model/document";
import type { ShapeHandlerRegistry } from "../model/shapeHandlers";

export interface ActionContext {
  registry: ShapeHandlerRegistry;
  change: (
    doc: DrawingDocument,
    update: (draft: DrawingDocumentData) => void,
  ) => DrawingDocument;
}

export interface UndoableAction {
  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument;
  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument;
  /** Returns IDs of shapes affected by this action for dirty tracking. */
  affectedShapeIds(): string[];
  affectsZOrder(): boolean;
}
