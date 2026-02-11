import type { DrawingDocument } from "../model/document";
import type { AnyShape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import {
  createPenJSONGeometry,
  getPenGeometryPoints,
  type PenShape,
} from "../model/shapes/penShape";
import type { ActionContext, UndoableAction } from "./types";
import { stripUndefined } from "./utils";

export class AddShape implements UndoableAction {
  private readonly inputShape: AnyShape;
  private canonicalShape?: AnyShape;

  constructor(shape: AnyShape) {
    this.inputShape = shape;
  }

  redo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.canonicalShape) {
      this.canonicalShape = compressSpraycanShape(
        canonicalizeShape(this.inputShape, ctx.registry),
      );
    }
    const safeShape = stripUndefined(this.canonicalShape);
    return ctx.change(doc, (draft) => {
      const nextTemporalOrder = draft.temporalOrderCounter ?? 0;
      draft.temporalOrderCounter = nextTemporalOrder + 1;
      draft.shapes[safeShape.id] = {
        ...safeShape,
        temporalOrder: nextTemporalOrder,
      };
    });
  }

  undo(doc: DrawingDocument, ctx: ActionContext): DrawingDocument {
    if (!this.canonicalShape) {
      throw new Error("Cannot undo AddShape before redo");
    }
    const canonicalShape = this.canonicalShape;
    return ctx.change(doc, (draft) => {
      delete draft.shapes[canonicalShape.id];
    });
  }

  affectedShapeIds(): string[] {
    return [this.inputShape.id];
  }

  affectsZOrder(): boolean {
    return true;
  }
}

function compressSpraycanShape(shape: AnyShape): AnyShape {
  if (shape.type !== "pen") {
    return shape;
  }
  const penShape = shape as PenShape;
  const brushId = penShape.style.stroke?.brushId;
  if (brushId !== "even-spraycan" && brushId !== "uneven-spraycan") {
    return shape;
  }
  const points = getPenGeometryPoints(penShape.geometry);
  if (!points.length) {
    return shape;
  }
  const compressedShape: PenShape = {
    ...penShape,
    geometry: createPenJSONGeometry(points),
  };
  return compressedShape as AnyShape;
}
