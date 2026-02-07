import type { DrawingDocument } from "../model/document";
import type { AnyShape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";
import { stripUndefined } from "./utils";

export class ClearCanvas implements UndoableAction {
  private readonly inputShape: AnyShape;
  private canonicalShape?: AnyShape;

  constructor(shape: AnyShape) {
    if (shape.type !== "clear") {
      throw new Error("ClearCanvas requires a clear shape.");
    }
    this.inputShape = shape;
  }

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.canonicalShape) {
      this.canonicalShape = canonicalizeShape(this.inputShape, ctx.registry);
    }
    const safeShape = stripUndefined(this.canonicalShape);
    return ctx.change(doc, (draft) => {
      const nextTemporalOrder = draft.temporalOrderCounter ?? 0;
      draft.temporalOrderCounter = nextTemporalOrder + 1;
      draft.shapes[safeShape.id] = {
        ...safeShape,
        temporalOrder: nextTemporalOrder,
      };
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.canonicalShape) {
      throw new Error("Cannot undo ClearCanvas before redo");
    }
    const canonicalShape = this.canonicalShape;
    return ctx.change(doc, (draft) => {
      delete draft.shapes[canonicalShape.id];
    });
  }

  affectedShapeIds(): string[] {
    return [this.inputShape.id];
  }

  affectsZOrder(): boolean {
    return true;
  }
}
