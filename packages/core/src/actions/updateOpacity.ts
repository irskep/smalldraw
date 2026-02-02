import type { DrawingDocument } from "../model/document";
import type { ActionContext, UndoableAction } from "./types";
import { requireShape } from "./utils";

export class UpdateShapeOpacity implements UndoableAction {
  private previous?: number;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextOpacity: number | undefined,
  ) {}

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      this.previous = shape.opacity;
      this.recorded = true;
    }
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(
          `Cannot update opacity for missing shape ${this.shapeId}`,
        );
      }
      if (this.nextOpacity === undefined) {
        delete target.opacity;
      } else {
        target.opacity = this.nextOpacity;
      }
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.recorded) {
      throw new Error(`Cannot undo opacity update for ${this.shapeId}`);
    }
    requireShape(doc, this.shapeId);
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(
          `Cannot undo opacity update for missing shape ${this.shapeId}`,
        );
      }
      if (this.previous === undefined) {
        delete target.opacity;
      } else {
        target.opacity = this.previous;
      }
    });
  }

  affectedShapeIds(): string[] {
    return [this.shapeId];
  }

  affectsZOrder(): boolean {
    return false;
  }
}
