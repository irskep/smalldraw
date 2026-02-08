import { describe, expect, test } from "bun:test";
import type { RectShape } from "@smalldraw/core";
import {
  type ActionContext,
  AddShape,
  UpdateShapeFill,
  UpdateShapeOpacity,
  UpdateShapeStroke,
  UpdateShapeZIndex,
} from "../actions";
import { createDocument } from "../model/document";
import { getDefaultShapeHandlerRegistry } from "../model/shapeHandlers";
import type { Fill, StrokeStyle } from "../model/style";
import { UndoManager } from "../undo";
import { getOrderedShapes, getZIndexBetween } from "../zindex";
import { change } from "@automerge/automerge/slim";

function baseShape(id: string): RectShape {
  return {
    id,
    type: "rect",
    zIndex: id,
    geometry: {
      type: "rect",
      size: [10, 10],
    },
    style: {
      fill: { type: "solid", color: "#000000" },
      stroke: { type: "brush", color: "#ffffff", size: 2 },
    },
  };
}

describe("Fill and stroke actions", () => {
  test("fill can switch between solid and gradient and undo restores original", () => {
    const registry = getDefaultShapeHandlerRegistry();
    let doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const shape = baseShape("fill-test");
    doc = undo.apply(new AddShape(shape), doc, ctx);

    const gradientFill: Fill = {
      type: "gradient",
      stops: [
        { offset: 0, color: "#ff0000" },
        { offset: 1, color: "#00ff00" },
      ],
      angle: 45,
    };

    doc = undo.apply(new UpdateShapeFill(shape.id, gradientFill), doc, ctx);
    expect(doc.shapes[shape.id]?.style.fill).toBeDefined();
    expect(doc.shapes[shape.id]!.style.fill).toMatchObject(gradientFill);

    doc = undo.undo(doc, ctx).doc;
    expect(doc.shapes[shape.id]?.style.fill).toBeDefined();
    expect(doc.shapes[shape.id]!.style.fill).toMatchObject(shape.style.fill!);

    doc = undo.redo(doc, ctx).doc;
    expect(doc.shapes[shape.id]?.style.fill).toBeDefined();
    expect(doc.shapes[shape.id]!.style.fill).toMatchObject(gradientFill);
  });

  test("stroke updates can remove or replace the style", () => {
    const registry = getDefaultShapeHandlerRegistry();
    let doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const shape = baseShape("stroke-test");
    doc = undo.apply(new AddShape(shape), doc, ctx);

    const newStroke: StrokeStyle = {
      type: "brush",
      color: "#123456",
      size: 4,
      brushId: "marker",
    };

    doc = undo.apply(new UpdateShapeStroke(shape.id, newStroke), doc, ctx);
    expect(doc.shapes[shape.id]?.style.stroke).toBeDefined();
    expect(doc.shapes[shape.id]!.style.stroke).toMatchObject(newStroke);

    doc = undo.apply(new UpdateShapeStroke(shape.id, undefined), doc, ctx);
    expect(doc.shapes[shape.id]?.style.stroke).toBeUndefined();

    doc = undo.undo(doc, ctx).doc;
    expect(doc.shapes[shape.id]?.style.stroke).toBeDefined();
    expect(doc.shapes[shape.id]!.style.stroke).toMatchObject(newStroke);
    doc = undo.undo(doc, ctx).doc;
    expect(doc.shapes[shape.id]?.style.stroke).toBeDefined();
    expect(doc.shapes[shape.id]!.style.stroke).toMatchObject(
      shape.style.stroke!,
    );
  });
});

describe("Z-index actions", () => {
  test("shapes reorder through z-index updates and helper sorts correctly", () => {
    const registry = getDefaultShapeHandlerRegistry();
    let doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const back = baseShape("a");
    const front = baseShape("b");
    back.zIndex = getZIndexBetween(null, null);
    front.zIndex = getZIndexBetween(back.zIndex, null);

    doc = undo.apply(new AddShape(back), doc, ctx);
    doc = undo.apply(new AddShape(front), doc, ctx);
    expect(getOrderedShapes(doc).map((shape) => shape.id)).toEqual(["a", "b"]);

    const newZ = getZIndexBetween(front.zIndex, null);
    doc = undo.apply(new UpdateShapeZIndex(back.id, newZ), doc, ctx);

    const ordered = getOrderedShapes(doc).map((shape) => shape.id);
    expect(ordered[ordered.length - 1]).toBe("a");

    doc = undo.undo(doc, ctx).doc;
    expect(getOrderedShapes(doc).map((shape) => shape.id)).toEqual(["a", "b"]);
  });
});

describe("Opacity actions", () => {
  test("opacity updates support undo/redo and clearing the value", () => {
    const registry = getDefaultShapeHandlerRegistry();
    let doc = createDocument([], registry);
    const undo = new UndoManager();
    const ctx: ActionContext = {
      registry,
      change: (next, update) => change(next, update),
    };
    const shape = baseShape("opacity");
    shape.style.opacity = 0.8;
    doc = undo.apply(new AddShape(shape), doc, ctx);

    doc = undo.apply(new UpdateShapeOpacity(shape.id, 0.5), doc, ctx);
    expect(doc.shapes[shape.id]?.style.opacity).toBe(0.5);

    doc = undo.apply(new UpdateShapeOpacity(shape.id, undefined), doc, ctx);
    expect(doc.shapes[shape.id]?.style.opacity).toBeUndefined();

    doc = undo.undo(doc, ctx).doc;
    expect(doc.shapes[shape.id]?.style.opacity).toBe(0.5);
    doc = undo.undo(doc, ctx).doc;
    expect(doc.shapes[shape.id]?.style.opacity).toBe(0.8);
    doc = undo.redo(doc, ctx).doc;
    expect(doc.shapes[shape.id]?.style.opacity).toBe(0.5);
  });
});
