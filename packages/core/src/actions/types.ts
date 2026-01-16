import type { DrawingDocument } from '../model/document';

export interface UndoableAction {
  redo(doc: DrawingDocument): void;
  undo(doc: DrawingDocument): void;
  /** Returns IDs of shapes affected by this action for dirty tracking. */
  affectedShapeIds(): string[];
}
