import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { RectShape } from "../../model/shapes/rectShape";
import { UndoManager } from "../../undo";
import { type ActionContext, CompositeAction, UpdateShapeTransform } from "..";

describe("UpdateShapeTransform action", () => {
  const v = (x = 0, y = x): [number, number] => [x, y];
  const baseShape: RectShape = {
    id: "shape-1",
    type: "rect",
    geometry: { type: "rect", size: v(10) },
    style: {},
    zIndex: "a",
    transform: {
      translation: v(0),
      rotation: 0,
      scale: v(1),
      origin: v(0),
    },
  };

  test("applies and undoes a single transform change", () => {
    const registry = getDefaultShapeHandlerRegistry();
    let doc = createDocument([baseShape], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const action = new UpdateShapeTransform("shape-1", {
      translation: v(5, -3),
      rotation: Math.PI / 4,
      scale: v(2, 0.5),
    });

    doc = undo.apply(action, doc, ctx);
    expect(doc.shapes["shape-1"]?.transform).toMatchObject({
      translation: v(5, -3),
      rotation: Math.PI / 4,
      scale: v(2, 0.5),
    });

    doc = undo.undo(doc, ctx).doc;
    expect(doc.shapes["shape-1"]?.transform).toBeDefined();
    expect(doc.shapes["shape-1"]!.transform).toMatchObject(
      baseShape.transform!,
    );
  });

  test("composite action batches multiple transform updates", () => {
    const registry = getDefaultShapeHandlerRegistry();
    let doc = createDocument([baseShape], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const move = new UpdateShapeTransform("shape-1", {
      translation: v(10, 0),
      rotation: 0,
      scale: v(1),
    });
    const rotate = new UpdateShapeTransform("shape-1", {
      translation: v(10, 0),
      rotation: Math.PI / 2,
      scale: v(1),
    });

    doc = undo.apply(new CompositeAction([move, rotate]), doc, ctx);
    expect(doc.shapes["shape-1"]?.transform).toMatchObject({
      translation: v(10, 0),
      rotation: Math.PI / 2,
      scale: v(1),
    });

    doc = undo.undo(doc, ctx).doc;
    expect(doc.shapes["shape-1"]?.transform).toBeDefined();
    expect(doc.shapes["shape-1"]!.transform).toMatchObject(
      baseShape.transform!,
    );
  });
});
