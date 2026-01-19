import type { DrawingDocument } from "../model/document";
import type { StrokeStyle } from "../model/style";
import type { ActionContext, UndoableAction } from "./types";
import { requireShape } from "./utils";

export class UpdateShapeStroke implements UndoableAction {
  private previous?: StrokeStyle;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextStroke: StrokeStyle | undefined,
  ) {}

  redo(doc: DrawingDocument, ctx: ActionContext): void {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      this.previous = shape.stroke;
      this.recorded = true;
    }
    shape.stroke = this.nextStroke;
  }

  undo(doc: DrawingDocument, ctx: ActionContext): void {
    if (!this.recorded) {
      throw new Error(`Cannot undo stroke update for ${this.shapeId}`);
    }
    const shape = requireShape(doc, this.shapeId);
    shape.stroke = this.previous;
  }

  affectedShapeIds(): string[] {
    return [this.shapeId];
  }

  affectsZOrder(): boolean {
    return false;
  }
}
