import { describe, expect, test } from "bun:test";

import { type ActionContext, AddShape, DeleteShape } from "../actions";
import { createDocument } from "../model/document";
import type { Shape } from "../model/shape";
import { canonicalizeShape } from "../model/shape";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import { UndoManager } from "../undo";

const rectangle: Shape = {
  id: "rect-1",
  geometry: {
    type: "rect",
    size: { width: 100, height: 50 },
  },
  fill: { type: "solid", color: "#ff0000" },
  zIndex: "a0",
  transform: {
    translation: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
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
