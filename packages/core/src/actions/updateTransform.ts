import type { DrawingDocument } from '../model/document';
import type { ShapeTransform } from '../model/shape';
import type { UndoableAction } from './types';
import { requireShape } from './utils';

export class UpdateShapeTransform implements UndoableAction {
  private previous?: ShapeTransform;
  private recorded = false;

  constructor(
    private readonly shapeId: string,
    private readonly nextTransform: ShapeTransform,
  ) {}

  redo(doc: DrawingDocument): void {
    const shape = requireShape(doc, this.shapeId);
    if (!this.recorded) {
      this.previous = shape.transform;
      this.recorded = true;
    }
    shape.transform = { ...this.nextTransform };
  }

  undo(doc: DrawingDocument): void {
    if (!this.recorded) {
      throw new Error(`Cannot undo transform update for ${this.shapeId}`);
    }
    const shape = requireShape(doc, this.shapeId);
    shape.transform = this.previous ? { ...this.previous } : undefined;
  }

  affectedShapeIds(): string[] {
    return [this.shapeId];
  }
}
