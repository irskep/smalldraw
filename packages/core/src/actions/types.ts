import type { DrawingDocument } from "../model/document";
import type { ShapeHandlerRegistry } from "../model/shapeHandlers";

export interface ActionContext {
  registry: ShapeHandlerRegistry;
}

export interface UndoableAction {
  redo(doc: DrawingDocument, ctx: ActionContext): void;
  undo(doc: DrawingDocument, ctx: ActionContext): void;
  /** Returns IDs of shapes affected by this action for dirty tracking. */
  affectedShapeIds(): string[];
  affectsZOrder(): boolean;
}
