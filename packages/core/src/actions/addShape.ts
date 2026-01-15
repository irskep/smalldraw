import type { DrawingDocument } from '../model/document';
import type { Shape } from '../model/shape';
import type { UndoableAction } from './types';

export class AddShape implements UndoableAction {
  constructor(private readonly shape: Shape) {}

  redo(doc: DrawingDocument): void {
    doc.shapes[this.shape.id] = this.shape;
  }

  undo(doc: DrawingDocument): void {
    delete doc.shapes[this.shape.id];
  }
}
