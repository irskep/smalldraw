import type { DrawingDocument } from '../model/document';
import type { Fill } from '../model/style';
import type { UndoableAction } from './types';
import { requireShape } from './utils';

export class UpdateShapeFill implements UndoableAction {
  private previous?: Fill;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextFill: Fill | undefined,
  ) {}

  redo(doc: DrawingDocument): void {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      this.previous = shape.fill;
      this.recorded = true;
    }
    shape.fill = this.nextFill;
  }

  undo(doc: DrawingDocument): void {
    if (!this.recorded) {
      throw new Error(`Cannot undo fill update for ${this.shapeId}`);
    }
    const shape = requireShape(doc, this.shapeId);
    shape.fill = this.previous;
  }
}
