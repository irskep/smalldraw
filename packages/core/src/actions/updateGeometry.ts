import type { AnyGeometry } from "@smalldraw/geometry";
import type { DrawingDocument } from "../model/document";
import type { ShapeTransform } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import type { ActionContext, UndoableAction } from "./types";
import { requireShape, stripUndefined } from "./utils";

export class UpdateShapeGeometry implements UndoableAction {
  private previousGeometry?: AnyGeometry;
  private previousTransform?: ShapeTransform;

  constructor(
    private readonly shapeId: string,
    private readonly newGeometry: AnyGeometry,
  ) {}

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    const shape = requireShape(doc, this.shapeId);
    if (!this.previousGeometry) {
      this.previousGeometry = stripUndefined(shape.geometry);
      this.previousTransform = shape.transform
        ? stripUndefined(shape.transform)
        : undefined;
    }
    const nextShape = {
      ...shape,
      geometry: this.newGeometry,
    };
    const canonical = canonicalizeShape(nextShape, ctx.registry);
    const safeGeometry = stripUndefined(canonical.geometry);
    const safeTransform = canonical.transform
      ? stripUndefined(canonical.transform)
      : undefined;
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(
          `Cannot update geometry for missing shape ${this.shapeId}`,
        );
      }
      target.geometry = safeGeometry;
      if (safeTransform) {
        target.transform = safeTransform;
      } else {
        delete target.transform;
      }
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.previousGeometry) {
      throw new Error(
        `Cannot undo geometry update for ${this.shapeId} because previous geometry was not recorded`,
      );
    }
    requireShape(doc, this.shapeId);
    const previousGeometry = this.previousGeometry;
    const previousTransform = this.previousTransform;
    return ctx.change(doc, (draft) => {
      const target = draft.shapes[this.shapeId];
      if (!target) {
        throw new Error(
          `Cannot undo geometry update for missing shape ${this.shapeId}`,
        );
      }
      target.geometry = previousGeometry;
      if (previousTransform) {
        target.transform = previousTransform;
      } else {
        delete target.transform;
      }
    });
  }

  affectedShapeIds(): string[] {
    return [this.shapeId];
  }

  affectsZOrder(): boolean {
    return false;
  }
}
