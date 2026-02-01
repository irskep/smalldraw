import { describe, expect, test } from "bun:test";
import type { AnyGeometry, PenGeometry } from "@smalldraw/geometry";
import { type ActionContext, AddShape, UpdateShapeGeometry } from "../actions";
import { createDocument } from "../model/document";
import type { AnyShape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import { UndoManager } from "../undo";
import { change } from "@automerge/automerge/slim";

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
        translation: [0, 0],
        scale: [1, 1],
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
    let doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const pen = createShape("pen", {
      type: "pen",
      points: [
        [0, 0],
        [10, 10],
      ],
    });

    doc = undo.apply(new AddShape(pen), doc, ctx);
    expect(doc.shapes[pen.id].geometry).toMatchObject(pen.geometry);

    const updatedGeometry: PenGeometry = {
      type: "pen",
      points: [
        [5, 5],
        [15, 15],
        [20, 0],
      ],
    };
    doc = undo.apply(new UpdateShapeGeometry(pen.id, updatedGeometry), doc, ctx);
    expect(doc.shapes[pen.id].geometry).toMatchObject(
      canonicalGeometry(pen, updatedGeometry).geometry,
    );
    doc = undo.undo(doc, ctx).doc;
    expect(doc.shapes[pen.id].geometry).toMatchObject(pen.geometry);
  });

  test("rect geometry persists bounds", () => {
    const registry = getDefaultShapeHandlerRegistry();
    let doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const rect = createShape("rect", {
      type: "rect",
      size: [100, 40],
    });
    doc = undo.apply(new AddShape(rect), doc, ctx);
    expect(doc.shapes[rect.id].geometry).toMatchObject(rect.geometry);

    const next = {
      type: "rect",
      size: [50, 50],
    };
    doc = undo.apply(new UpdateShapeGeometry(rect.id, next), doc, ctx);
    expect(doc.shapes[rect.id].geometry).toMatchObject(next);
    doc = undo.undo(doc, ctx).doc;
    expect(doc.shapes[rect.id].geometry).toMatchObject(rect.geometry);
  });
});
