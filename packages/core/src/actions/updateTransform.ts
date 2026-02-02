import type { DrawingDocument } from "../model/document";
import { cloneTransform, type ShapeTransform } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";
import { requireShape } from "./utils";

export class UpdateShapeTransform implements UndoableAction {
  private previous?: ShapeTransform;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextTransform: ShapeTransform,
  ) {}

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      // Clone tuple arrays so undo snapshots don't retain Automerge-backed references.
      this.previous = shape.transform
        ? cloneTransform(shape.transform)
        : undefined;
      this.recorded = true;
    }
    const nextTransform = cloneTransform(this.nextTransform);
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(
          `Cannot update transform for missing shape ${this.shapeId}`,
        );
      }
      target.transform = nextTransform;
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.recorded) {
      throw new Error(`Cannot undo transform update for ${this.shapeId}`);
    }
    requireShape(doc, this.shapeId);
    const previousTransform = this.previous;
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(
          `Cannot undo transform update for missing shape ${this.shapeId}`,
        );
      }
      if (!previousTransform) {
        delete target.transform;
        return;
      }
      target.transform = previousTransform;
    });
  }

  affectedShapeIds(): string[] {
    return [this.shapeId];
  }

  affectsZOrder(): boolean {
    return false;
  }
}
