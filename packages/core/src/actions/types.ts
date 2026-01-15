import type { DrawingDocument } from '../model/document';

export interface UndoableAction {
  redo(doc: DrawingDocument): void;
  undo(doc: DrawingDocument): void;
}
