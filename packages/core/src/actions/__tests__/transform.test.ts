import { describe, expect, test } from "bun:test";
import { makePoint } from "@smalldraw/geometry";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { RectShape } from "../../model/shapes/rectShape";
import { UndoManager } from "../../undo";
import { type ActionContext, CompositeAction, UpdateShapeTransform } from "..";

describe("UpdateShapeTransform action", () => {
  const baseShape: RectShape = {
    id: "shape-1",
    type: "rect",
    geometry: { type: "rect", size: makePoint(10) },
    zIndex: "a",
    transform: {
      translation: makePoint(),
      rotation: 0,
      scale: makePoint(1),
      origin: makePoint(),
    },
  };

  test("applies and undoes a single transform change", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([baseShape], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const action = new UpdateShapeTransform("shape-1", {
      translation: makePoint(5, -3),
      rotation: Math.PI / 4,
      scale: makePoint(2, 0.5),
    });

    undo.apply(action, doc, ctx);
    expect(doc.shapes["shape-1"]?.transform).toEqual({
      translation: makePoint(5, -3),
      rotation: Math.PI / 4,
      scale: makePoint(2, 0.5),
    });

    undo.undo(doc, ctx);
    expect(doc.shapes["shape-1"]?.transform).toEqual(baseShape.transform);
  });

  test("composite action batches multiple transform updates", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([baseShape], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const move = new UpdateShapeTransform("shape-1", {
      translation: makePoint(10, 0),
      rotation: 0,
      scale: makePoint(1),
    });
    const rotate = new UpdateShapeTransform("shape-1", {
      translation: makePoint(10, 0),
      rotation: Math.PI / 2,
      scale: makePoint(1),
    });

    undo.apply(new CompositeAction([move, rotate]), doc, ctx);
    expect(doc.shapes["shape-1"]?.transform).toEqual({
      translation: makePoint(10, 0),
      rotation: Math.PI / 2,
      scale: makePoint(1),
    });

    undo.undo(doc, ctx);
    expect(doc.shapes["shape-1"]?.transform).toEqual(baseShape.transform);
  });
});
