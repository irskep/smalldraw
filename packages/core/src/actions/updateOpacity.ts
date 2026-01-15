import type { DrawingDocument } from '../model/document';
import type { UndoableAction } from './types';
import { requireShape } from './utils';

export class UpdateShapeOpacity implements UndoableAction {
  private previous?: number;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextOpacity: number | undefined,
  ) {}

  redo(doc: DrawingDocument): void {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      this.previous = shape.opacity;
      this.recorded = true;
    }
    shape.opacity = this.nextOpacity;
  }

  undo(doc: DrawingDocument): void {
    if (!this.recorded) {
      throw new Error(`Cannot undo opacity update for ${this.shapeId}`);
    }
    const shape = requireShape(doc, this.shapeId);
    shape.opacity = this.previous;
  }
}
