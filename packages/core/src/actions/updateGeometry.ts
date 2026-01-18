import type { DrawingDocument } from "../model/document";
import type { Geometry } from "../model/geometry";
import type { ShapeTransform } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";
import { requireShape } from "./utils";

export class UpdateShapeGeometry implements UndoableAction {
  private previousGeometry?: Geometry;
  private previousTransform?: ShapeTransform;

  constructor(
    private readonly shapeId: string,
    private readonly newGeometry: Geometry
  ) {}

  redo(doc: DrawingDocument, ctx: ActionContext): void {
    const shape = requireShape(doc, this.shapeId);
    if (!this.previousGeometry) {
      this.previousGeometry = shape.geometry;
      this.previousTransform = shape.transform;
    }
    shape.geometry = this.newGeometry;
    const canonical = canonicalizeShape(shape, ctx.registry);
    shape.geometry = canonical.geometry;
    shape.transform = canonical.transform;
  }

  undo(doc: DrawingDocument, ctx: ActionContext): void {
    if (!this.previousGeometry) {
      throw new Error(
        `Cannot undo geometry update for ${this.shapeId} because previous geometry was not recorded`
      );
    }
    const shape = requireShape(doc, this.shapeId);
    shape.geometry = this.previousGeometry;
    shape.transform = this.previousTransform;
  }

  affectedShapeIds(): string[] {
    return [this.shapeId];
  }

  affectsZOrder(): boolean {
    return false;
  }
}
