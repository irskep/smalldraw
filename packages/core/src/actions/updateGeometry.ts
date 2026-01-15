import type { DrawingDocument } from '../model/document';
import type { Geometry } from '../model/geometry';
import type { UndoableAction } from './types';
import { requireShape } from './utils';

export class UpdateShapeGeometry implements UndoableAction {
  private previous?: Geometry;

  constructor(
    private readonly shapeId: string,
    private readonly newGeometry: Geometry,
  ) {}

  redo(doc: DrawingDocument): void {
    const shape = requireShape(doc, this.shapeId);
    if (!this.previous) {
      this.previous = shape.geometry;
    }
    shape.geometry = this.newGeometry;
  }

  undo(doc: DrawingDocument): void {
    if (!this.previous) {
      throw new Error(
        `Cannot undo geometry update for ${this.shapeId} because previous geometry was not recorded`,
      );
    }
    const shape = requireShape(doc, this.shapeId);
    shape.geometry = this.previous;
  }
}
