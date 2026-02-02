import type { DrawingDocument } from "../model/document";
import type { Fill } from "../model/style";
import type { ActionContext, UndoableAction } from "./types";
import { requireShape, stripUndefined } from "./utils";

export class UpdateShapeFill implements UndoableAction {
  private previous?: Fill;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextFill: Fill | undefined,
  ) {}

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      this.previous = shape.fill ? stripUndefined(shape.fill) : undefined;
      this.recorded = true;
    }
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(`Cannot update fill for missing shape ${this.shapeId}`);
      }
      if (this.nextFill === undefined) {
        delete target.fill;
      } else {
        target.fill = stripUndefined(this.nextFill);
      }
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.recorded) {
      throw new Error(`Cannot undo fill update for ${this.shapeId}`);
    }
    requireShape(doc, this.shapeId);
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(
          `Cannot undo fill update for missing shape ${this.shapeId}`,
        );
      }
      if (this.previous === undefined) {
        delete target.fill;
      } else {
        target.fill = this.previous;
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
