import type { DrawingDocument } from "../model/document";
import type { StrokeStyle } from "../model/style";
import type { ActionContext, UndoableAction } from "./types";
import { requireShape, stripUndefined } from "./utils";

export class UpdateShapeStroke implements UndoableAction {
  private previous?: StrokeStyle;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextStroke: StrokeStyle | undefined,
  ) {}

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      this.previous = shape.style.stroke
        ? stripUndefined(shape.style.stroke)
        : undefined;
      this.recorded = true;
    }
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(
          `Cannot update stroke for missing shape ${this.shapeId}`,
        );
      }
      if (this.nextStroke === undefined) {
        delete target.style.stroke;
      } else {
        target.style.stroke = stripUndefined(this.nextStroke);
      }
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.recorded) {
      throw new Error(`Cannot undo stroke update for ${this.shapeId}`);
    }
    requireShape(doc, this.shapeId);
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(
          `Cannot undo stroke update for missing shape ${this.shapeId}`,
        );
      }
      if (this.previous === undefined) {
        delete target.style.stroke;
      } else {
        target.style.stroke = this.previous;
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
