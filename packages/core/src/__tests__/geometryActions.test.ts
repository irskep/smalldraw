import { describe, expect, test } from "bun:test";

import { type ActionContext, AddShape, UpdateShapeGeometry } from "../actions";
import { createDocument } from "../model/document";
import type { Shape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import { UndoManager } from "../undo";

type ShapeWithGeometry = Shape & { geometry: unknown };

function getGeometry(shape: Shape | undefined): unknown {
  return (shape as ShapeWithGeometry | undefined)?.geometry;
}

function createShape(id: string, geometry: unknown): ShapeWithGeometry {
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
    } as ShapeWithGeometry,
    registry,
  );
}

function canonicalGeometry(
  shape: ShapeWithGeometry,
  geometry: unknown,
): unknown {
  const registry = getDefaultShapeHandlerRegistry();
  return canonicalizeShape(
    { ...shape, geometry } as ShapeWithGeometry,
    registry,
  ).geometry;
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
    expect(getGeometry(doc.shapes[pen.id])).toEqual(pen.geometry);

    const updatedGeometry = {
      type: "pen",
      points: [
        { x: 5, y: 5 },
        { x: 15, y: 15 },
        { x: 20, y: 0 },
      ],
      simulatePressure: true,
    };
    undo.apply(new UpdateShapeGeometry(pen.id, updatedGeometry), doc, ctx);
    expect(getGeometry(doc.shapes[pen.id])).toEqual(
      canonicalGeometry(pen, updatedGeometry),
    );
    undo.undo(doc, ctx);
    expect(getGeometry(doc.shapes[pen.id])).toEqual(pen.geometry);
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
    expect(getGeometry(doc.shapes[rect.id])).toEqual(rect.geometry);

    const next = {
      type: "rect",
      size: { width: 50, height: 50 },
    };
    undo.apply(new UpdateShapeGeometry(rect.id, next), doc, ctx);
    expect(getGeometry(doc.shapes[rect.id])).toEqual(next);
    undo.undo(doc, ctx);
    expect(getGeometry(doc.shapes[rect.id])).toEqual(rect.geometry);
  });
});
