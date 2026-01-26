import type { DrawingDocument } from "../model/document";
import type { AnyShape } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";

export class DeleteShape implements UndoableAction {
  private deletedShape?: AnyShape;

  constructor(private readonly shapeId: string) {}

  redo(doc: DrawingDocument, _ctx: ActionContext): void {
    if (!this.deletedShape) {
      this.deletedShape = doc.shapes[this.shapeId];
    }
    delete doc.shapes[this.shapeId];
  }

  undo(doc: DrawingDocument, _ctx: ActionContext): void {
    if (!this.deletedShape) {
      throw new Error(
        `Cannot undo delete because shape ${this.shapeId} was never captured`,
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
