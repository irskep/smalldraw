import { describe, expect, test } from "bun:test";
import type { RectShape } from "@smalldraw/core";
import { Vec2 } from "gl-matrix";
import { type ActionContext, AddShape, DeleteShape } from "../actions";
import { createDocument } from "../model/document";
import { canonicalizeShape } from "../model/shape";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import { UndoManager } from "../undo";

const rectangle: RectShape = {
  id: "rect-1",
  type: "rect",
  geometry: {
    type: "rect",
    size: new Vec2(100, 50),
  },
  fill: { type: "solid", color: "#ff0000" },
  zIndex: "a0",
  transform: {
    translation: new Vec2(),
    scale: new Vec2(1, 1),
    rotation: 0,
  },
};

const registry = getDefaultShapeHandlerRegistry();
const canonicalRectangle = canonicalizeShape(rectangle, registry);

describe("Undo stack interactions for rectangle shapes", () => {
  test("AddShape action can be undone/redone", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const addAction = new AddShape(rectangle);

    undo.apply(addAction, doc, ctx);
    expect(doc.shapes[rectangle.id]).toEqual(canonicalRectangle);
    expect(undo.canUndo()).toBe(true);
    expect(undo.canRedo()).toBe(false);

    expect(undo.undo(doc, ctx)).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toBeUndefined();
    expect(undo.canRedo()).toBe(true);

    expect(undo.redo(doc, ctx)).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toEqual(canonicalRectangle);
  });

  test("DeleteShape action restores removed rectangle on undo", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([rectangle], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const deleteAction = new DeleteShape(rectangle.id);

    undo.apply(deleteAction, doc, ctx);
    expect(doc.shapes[rectangle.id]).toBeUndefined();

    expect(undo.undo(doc, ctx)).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toEqual(canonicalRectangle);

    expect(undo.redo(doc, ctx)).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toBeUndefined();
  });
});
