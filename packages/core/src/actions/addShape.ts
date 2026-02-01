import type { DrawingDocument } from "../model/document";
import type { AnyShape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";
import { stripUndefined } from "./utils";

export class AddShape implements UndoableAction {
  private readonly inputShape: AnyShape;
  private canonicalShape?: AnyShape;

  constructor(shape: AnyShape) {
    this.inputShape = shape;
  }

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.canonicalShape) {
      this.canonicalShape = canonicalizeShape(this.inputShape, ctx.registry);
    }
    const safeShape = stripUndefined(this.canonicalShape!);
    return ctx.change(doc, (draft) => {
      draft.shapes[safeShape.id] = safeShape;
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.canonicalShape) {
      throw new Error("Cannot undo AddShape before redo");
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
