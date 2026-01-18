import type { DrawingDocument } from "../model/document";
import type { Shape } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";

export class DeleteShape implements UndoableAction {
  private deletedShape?: Shape;

  constructor(private readonly shapeId: string) {}

  redo(doc: DrawingDocument, ctx: ActionContext): void {
    if (!this.deletedShape) {
      this.deletedShape = doc.shapes[this.shapeId];
    }
    delete doc.shapes[this.shapeId];
  }

  undo(doc: DrawingDocument, ctx: ActionContext): void {
    if (!this.deletedShape) {
      throw new Error(
        `Cannot undo delete because shape ${this.shapeId} was never captured`
      );
    }
    doc.shapes[this.shapeId] = this.deletedShape;
  }

  affectedShapeIds(): string[] {
    return [this.shapeId];
  }

  affectsZOrder(): boolean {
    return true;
  }
}
