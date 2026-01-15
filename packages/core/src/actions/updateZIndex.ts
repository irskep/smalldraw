import type { DrawingDocument } from '../model/document';
import type { UndoableAction } from './types';
import { requireShape } from './utils';

export class UpdateShapeZIndex implements UndoableAction {
  private previous?: string;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextZIndex: string,
  ) {}

  redo(doc: DrawingDocument): void {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      this.previous = shape.zIndex;
      this.recorded = true;
    }
    shape.zIndex = this.nextZIndex;
  }

  undo(doc: DrawingDocument): void {
    if (!this.recorded || this.previous === undefined) {
      throw new Error(`Cannot undo z-index update for ${this.shapeId}`);
    }
    const shape = requireShape(doc, this.shapeId);
    shape.zIndex = this.previous;
  }
}
