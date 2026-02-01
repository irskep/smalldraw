import type { ActionContext, UndoableAction } from "./actions";
import type { DrawingDocument } from "./model/document";

export interface UndoOutcome {
  doc: DrawingDocument;
  action: UndoableAction | null;
  error?: string;
}

export class UndoManager {
  private undoStack: UndoableAction[] = [];
  private redoStack: UndoableAction[] = [];

  apply(
    action: UndoableAction,
    doc: DrawingDocument,
    ctx: ActionContext,
  ): DrawingDocument {
    const nextDoc = action.redo(doc, ctx);
    this.undoStack.push(action);
    this.redoStack = [];
    return nextDoc;
  }

  undo(doc: DrawingDocument, ctx: ActionContext): UndoOutcome {
    const action = this.undoStack.pop();
    if (!action) {
      return { doc, action: null };
    }
    try {
      const nextDoc = action.undo(doc, ctx);
      this.redoStack.push(action);
      return { doc: nextDoc, action };
    } catch (error) {
      this.undoStack.push(action);
      return {
        doc,
        action: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  redo(doc: DrawingDocument, ctx: ActionContext): UndoOutcome {
    const action = this.redoStack.pop();
    if (!action) {
      return { doc, action: null };
    }
    try {
      const nextDoc = action.redo(doc, ctx);
      this.undoStack.push(action);
      return { doc: nextDoc, action };
    } catch (error) {
      this.redoStack.push(action);
      return {
        doc,
        action: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
