import type { DrawingDocument } from "../model/document";
import type { AnyShape } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";
import { stripUndefined } from "./utils";

export class DeleteShape implements UndoableAction {
  private deletedShape?: AnyShape;

  constructor(private readonly shapeId: string) {}

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.deletedShape) {
      const shape = doc.shapes[this.shapeId];
      this.deletedShape = shape ? stripUndefined(shape) : undefined;
    }
    return ctx.change(doc, (draft) => {
      delete draft.shapes[this.shapeId];
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.deletedShape) {
      throw new Error(
        `Cannot undo delete because shape ${this.shapeId} was never captured`,
      );
    }
    const restored = this.deletedShape;
    return ctx.change(doc, (draft) => {
      draft.shapes[this.shapeId] = restored;
    });
  }

  affectedShapeIds(): string[] {
    return [this.shapeId];
  }

  affectsZOrder(): boolean {
    return true;
  }
}
