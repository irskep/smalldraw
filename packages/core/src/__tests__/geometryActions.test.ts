import { describe, expect, test } from "bun:test";
import type { AnyGeometry, PenGeometry } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { type ActionContext, AddShape, UpdateShapeGeometry } from "../actions";
import { createDocument } from "../model/document";
import type { AnyShape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import { UndoManager } from "../undo";

function createShape(id: string, geometry: unknown): AnyShape {
  const registry = getDefaultShapeHandlerRegistry();
  const shapeType = (geometry as { type: string }).type;
  return canonicalizeShape(
    {
      id,
      type: shapeType,
      geometry,
      zIndex: id,
      transform: {
        translation: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      },
    } as AnyShape,
    registry,
  );
}

function canonicalGeometry(shape: AnyShape, geometry: AnyGeometry): AnyShape {
  const registry = getDefaultShapeHandlerRegistry();
  return canonicalizeShape({ ...shape, geometry }, registry);
}

describe("Geometry actions", () => {
  test("pen geometry can be added and updated", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const pen = createShape("pen", {
      type: "pen",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    });

    undo.apply(new AddShape(pen), doc, ctx);
    expect(doc.shapes[pen.id].geometry).toEqual(pen.geometry);

    const updatedGeometry: PenGeometry = {
      type: "pen",
      points: [new Vec2(5), new Vec2(15), new Vec2(20, 0)],
      pressures: undefined,
    };
    undo.apply(new UpdateShapeGeometry(pen.id, updatedGeometry), doc, ctx);
    expect(doc.shapes[pen.id].geometry).toEqual(
      canonicalGeometry(pen, updatedGeometry).geometry,
    );
    undo.undo(doc, ctx);
    expect(doc.shapes[pen.id].geometry).toEqual(pen.geometry);
  });

  test("rect geometry persists bounds", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const rect = createShape("rect", {
      type: "rect",
      size: { width: 100, height: 40 },
    });
    undo.apply(new AddShape(rect), doc, ctx);
    expect(doc.shapes[rect.id].geometry).toEqual(rect.geometry);

    const next = {
      type: "rect",
      size: { width: 50, height: 50 },
    };
    undo.apply(new UpdateShapeGeometry(rect.id, next), doc, ctx);
    expect(doc.shapes[rect.id].geometry).toEqual(next);
    undo.undo(doc, ctx);
    expect(doc.shapes[rect.id].geometry).toEqual(rect.geometry);
  });
});
