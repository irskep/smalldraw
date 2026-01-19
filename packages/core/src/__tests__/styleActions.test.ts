import { describe, expect, test } from "bun:test";

import {
  AddShape,
  UpdateShapeFill,
  UpdateShapeStroke,
  UpdateShapeZIndex,
  UpdateShapeOpacity,
  type ActionContext,
} from "../actions";
import { createDocument } from "../model/document";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import type { Shape } from "../model/shape";
import type { Fill, StrokeStyle } from "../model/style";
import { UndoManager } from "../undo";
import { getOrderedShapes, getZIndexBetween } from "../zindex";

function baseShape(id: string): Shape {
  return {
    id,
    zIndex: id,
    geometry: {
      type: "rect",
      size: { width: 10, height: 10 },
    },
    fill: { type: "solid", color: "#000000" },
    stroke: { type: "brush", color: "#ffffff", size: 2 },
  };
}

describe("Fill and stroke actions", () => {
  test("fill can switch between solid and gradient and undo restores original", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const shape = baseShape("fill-test");
    undo.apply(new AddShape(shape), doc, ctx);

    const gradientFill: Fill = {
      type: "gradient",
      stops: [
        { offset: 0, color: "#ff0000" },
        { offset: 1, color: "#00ff00" },
      ],
      angle: 45,
    };

    undo.apply(new UpdateShapeFill(shape.id, gradientFill), doc, ctx);
    expect(doc.shapes[shape.id]?.fill).toEqual(gradientFill);

    undo.undo(doc, ctx);
    expect(doc.shapes[shape.id]?.fill).toEqual(shape.fill);

    undo.redo(doc, ctx);
    expect(doc.shapes[shape.id]?.fill).toEqual(gradientFill);
  });

  test("stroke updates can remove or replace the style", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const shape = baseShape("stroke-test");
    undo.apply(new AddShape(shape), doc, ctx);

    const newStroke: StrokeStyle = {
      type: "brush",
      color: "#123456",
      size: 4,
      brushId: "marker",
    };

    undo.apply(new UpdateShapeStroke(shape.id, newStroke), doc, ctx);
    expect(doc.shapes[shape.id]?.stroke).toEqual(newStroke);

    undo.apply(new UpdateShapeStroke(shape.id, undefined), doc, ctx);
    expect(doc.shapes[shape.id]?.stroke).toBeUndefined();

    undo.undo(doc, ctx);
    expect(doc.shapes[shape.id]?.stroke).toEqual(newStroke);
    undo.undo(doc, ctx);
    expect(doc.shapes[shape.id]?.stroke).toEqual(shape.stroke);
  });
});

describe("Z-index actions", () => {
  test("shapes reorder through z-index updates and helper sorts correctly", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const back = baseShape("a");
    const front = baseShape("b");
    back.zIndex = getZIndexBetween(null, null);
    front.zIndex = getZIndexBetween(back.zIndex, null);

    undo.apply(new AddShape(back), doc, ctx);
    undo.apply(new AddShape(front), doc, ctx);
    expect(getOrderedShapes(doc).map((shape) => shape.id)).toEqual(["a", "b"]);

    const newZ = getZIndexBetween(front.zIndex, null);
    undo.apply(new UpdateShapeZIndex(back.id, newZ), doc, ctx);

    const ordered = getOrderedShapes(doc).map((shape) => shape.id);
    expect(ordered[ordered.length - 1]).toBe("a");

    undo.undo(doc, ctx);
    expect(getOrderedShapes(doc).map((shape) => shape.id)).toEqual(["a", "b"]);
  });
});

describe("Opacity actions", () => {
  test("opacity updates support undo/redo and clearing the value", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = { registry };
    const shape = baseShape("opacity");
    shape.opacity = 0.8;
    undo.apply(new AddShape(shape), doc, ctx);

    undo.apply(new UpdateShapeOpacity(shape.id, 0.5), doc, ctx);
    expect(doc.shapes[shape.id]?.opacity).toBe(0.5);

    undo.apply(new UpdateShapeOpacity(shape.id, undefined), doc, ctx);
    expect(doc.shapes[shape.id]?.opacity).toBeUndefined();

    undo.undo(doc, ctx);
    expect(doc.shapes[shape.id]?.opacity).toBe(0.5);
    undo.undo(doc, ctx);
    expect(doc.shapes[shape.id]?.opacity).toBe(0.8);
    undo.redo(doc, ctx);
    expect(doc.shapes[shape.id]?.opacity).toBe(0.5);
  });
});
