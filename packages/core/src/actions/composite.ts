import type { DrawingDocument } from "../model/document";
import type { ActionContext, UndoableAction } from "./types";

export class CompositeAction implements UndoableAction {
  constructor(private readonly actions: UndoableAction[]) {}

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    let next = doc;
    for (const action of this.actions) {
      next = action.redo(next, ctx);
    }
    return next;
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    let next = doc;
    for (let i = this.actions.length - 1; i >= 0; i -= 1) {
      next = this.actions[i].undo(next, ctx);
    }
    return next;
  }

  affectedShapeIds(): string[] {
    const ids = new Set<string>();
    for (const action of this.actions) {
      for (const id of action.affectedShapeIds()) {
        ids.add(id);
      }
    }
    return Array.from(ids);
  }

  affectsZOrder(): boolean {
    return this.actions.some((item) => item.affectsZOrder());
  }
}
