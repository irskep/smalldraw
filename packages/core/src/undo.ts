import type { DrawingDocument } from './model/document';
import type { UndoableAction } from './actions';

export class UndoManager {
  private undoStack: UndoableAction[] = [];
  private redoStack: UndoableAction[] = [];

  apply(action: UndoableAction, doc: DrawingDocument): void {
    action.redo(doc);
    this.undoStack.push(action);
    this.redoStack = [];
  }

  undo(doc: DrawingDocument): boolean {
    const action = this.undoStack.pop();
    if (!action) {
      return false;
    }
    action.undo(doc);
    this.redoStack.push(action);
    return true;
  }

  redo(doc: DrawingDocument): boolean {
    const action = this.redoStack.pop();
    if (!action) {
      return false;
    }
    action.redo(doc);
    this.undoStack.push(action);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
