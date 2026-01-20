import type { DrawingDocument } from "../model/document";
import type { Shape, ShapeTransform } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";
import { requireShape } from "./utils";

type ShapeWithGeometry = Shape & { geometry: unknown };

export class UpdateShapeGeometry implements UndoableAction {
  private previousGeometry?: unknown;
  private previousTransform?: ShapeTransform;

  constructor(
    private readonly shapeId: string,
    private readonly newGeometry: unknown,
  ) {}

  redo(doc: DrawingDocument, ctx: ActionContext): void {
    const shape = requireShape(doc, this.shapeId) as ShapeWithGeometry;
    if (!this.previousGeometry) {
      this.previousGeometry = shape.geometry;
      this.previousTransform = shape.transform;
    }
    shape.geometry = this.newGeometry;
    const canonical = canonicalizeShape(shape, ctx.registry);
    shape.geometry = canonical.geometry;
    shape.transform = canonical.transform;
  }

  undo(doc: DrawingDocument, _ctx: ActionContext): void {
    if (!this.previousGeometry) {
      throw new Error(
        `Cannot undo geometry update for ${this.shapeId} because previous geometry was not recorded`,
      );
    }
    const shape = requireShape(doc, this.shapeId) as ShapeWithGeometry;
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
