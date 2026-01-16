import type { DrawingDocument } from "../model/document";
import type { UndoableAction } from "./types";

export class CompositeAction implements UndoableAction {
  constructor(private readonly actions: UndoableAction[]) {}

  redo(doc: DrawingDocument): void {
    for (const action of this.actions) {
      action.redo(doc);
    }
  }

  undo(doc: DrawingDocument): void {
    for (let i = this.actions.length - 1; i >= 0; i -= 1) {
      this.actions[i].undo(doc);
    }
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
