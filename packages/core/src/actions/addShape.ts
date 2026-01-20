import type { DrawingDocument } from "../model/document";
import type { Shape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";

export class AddShape implements UndoableAction {
  private readonly inputShape: Shape;
  private canonicalShape?: Shape;

  constructor(shape: Shape) {
    this.inputShape = shape;
  }

  redo(doc: DrawingDocument, ctx: ActionContext): void {
    if (!this.canonicalShape) {
      this.canonicalShape = canonicalizeShape(this.inputShape, ctx.registry);
    }
    doc.shapes[this.canonicalShape.id] = this.canonicalShape;
  }

  undo(doc: DrawingDocument, _ctx: ActionContext): void {
    if (!this.canonicalShape) {
      throw new Error("Cannot undo AddShape before redo");
    }
    delete doc.shapes[this.canonicalShape.id];
  }

  affectedShapeIds(): string[] {
    return [this.inputShape.id];
  }

  affectsZOrder(): boolean {
    return true;
  }
}
