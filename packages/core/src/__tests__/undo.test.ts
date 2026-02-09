import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import type { RectShape } from "@smalldraw/core";
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
    size: [100, 50],
  },
  style: { fill: { type: "solid", color: "#ff0000" } },
  zIndex: "a0",
  transform: {
    translation: [0, 0],
    scale: [1, 1],
    rotation: 0,
  },
};

const registry = getDefaultShapeHandlerRegistry();
const canonicalRectangle = canonicalizeShape(rectangle, registry);

describe("Undo stack interactions for rectangle shapes", () => {
  test("AddShape action can be undone/redone", () => {
    const registry = getDefaultShapeHandlerRegistry();
    let doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const addAction = new AddShape(rectangle);

    doc = undo.apply(addAction, doc, ctx);
    expect(doc.shapes[rectangle.id]).toMatchObject(canonicalRectangle);
    expect(doc.shapes[rectangle.id]?.temporalOrder).toBe(0);
    expect(undo.canUndo()).toBe(true);
    expect(undo.canRedo()).toBe(false);

    const undoOutcome = undo.undo(doc, ctx);
    doc = undoOutcome.doc;
    expect(undoOutcome.action).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toBeUndefined();
    expect(undo.canRedo()).toBe(true);

    const redoOutcome = undo.redo(doc, ctx);
    doc = redoOutcome.doc;
    expect(redoOutcome.action).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toMatchObject(canonicalRectangle);
    expect(doc.shapes[rectangle.id]?.temporalOrder).toBe(1);
  });

  test("DeleteShape action restores removed rectangle on undo", () => {
    const registry = getDefaultShapeHandlerRegistry();
    let doc = createDocument([rectangle], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const deleteAction = new DeleteShape(rectangle.id);

    doc = undo.apply(deleteAction, doc, ctx);
    expect(doc.shapes[rectangle.id]).toBeUndefined();

    const undoOutcome = undo.undo(doc, ctx);
    doc = undoOutcome.doc;
    expect(undoOutcome.action).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toEqual(canonicalRectangle);

    const redoOutcome = undo.redo(doc, ctx);
    doc = redoOutcome.doc;
    expect(redoOutcome.action).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toBeUndefined();
  });
});
