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

  undo(doc: DrawingDocument): UndoableAction | null {
    const action = this.undoStack.pop();
    if (!action) {
      return null;
    }
    action.undo(doc);
    this.redoStack.push(action);
    return action;
  }

  redo(doc: DrawingDocument): UndoableAction | null {
    const action = this.redoStack.pop();
    if (!action) {
      return null;
    }
    action.redo(doc);
    this.undoStack.push(action);
    return action;
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
