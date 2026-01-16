import type { DrawingDocument } from '../model/document';
import type { Shape } from '../model/shape';
import { canonicalizeShape } from '../model/shape';
import type { UndoableAction } from './types';

export class AddShape implements UndoableAction {
  private readonly shape: Shape;

  constructor(shape: Shape) {
    this.shape = canonicalizeShape(shape);
  }

  redo(doc: DrawingDocument): void {
    doc.shapes[this.shape.id] = this.shape;
  }

  undo(doc: DrawingDocument): void {
    delete doc.shapes[this.shape.id];
  }

  affectedShapeIds(): string[] {
    return [this.shape.id];
  }
}
