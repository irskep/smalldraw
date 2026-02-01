import type { DrawingDocument } from "../model/document";
import type { ActionContext, UndoableAction } from "./types";
import { requireShape } from "./utils";

export class UpdateShapeZIndex implements UndoableAction {
  private previous?: string;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextZIndex: string,
  ) {}

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      this.previous = shape.zIndex;
      this.recorded = true;
    }
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(`Cannot update z-index for missing shape ${this.shapeId}`);
      }
      target.zIndex = this.nextZIndex;
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.recorded || this.previous === undefined) {
      throw new Error(`Cannot undo z-index update for ${this.shapeId}`);
    }
    requireShape(doc, this.shapeId);
    const previous = this.previous;
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(`Cannot undo z-index update for missing shape ${this.shapeId}`);
      }
      target.zIndex = previous;
    });
  }

  affectedShapeIds(): string[] {
    return [this.shapeId];
  }

  affectsZOrder(): boolean {
    return true;
  }
}
