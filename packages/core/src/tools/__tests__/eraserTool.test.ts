import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import { BoxOperations } from "@smalldraw/geometry";
import { expectPointsClose, getWorldPointsFromShape } from "@smalldraw/testing";
import { Vec2 } from "gl-matrix";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { PenShape } from "../../model/shapes/penShape";
import { UndoManager } from "../../undo";
import { createEraserTool } from "../drawingTools";
import { ToolRuntimeImpl } from "../runtime";

describe("eraser tool integration with runtime", () => {
  function setup() {
    const registry = getDefaultShapeHandlerRegistry();
    let document = createDocument(undefined, registry);
    const undoManager = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: "eraser.basic",
      getDocument: () => document,
      commitAction: (action) => {
        document = undoManager.apply(action, document, {
          registry,
          change: (next, update) => change(next, update),
        });
      },
      shapeHandlers: registry,
    });
    const tool = createEraserTool();
    const deactivate = tool.activate(runtime);
    return { runtime, getDocument: () => document, deactivate };
  }

  test("collects pointer events into draft stroke and commits at pointer up", () => {
    const { runtime, getDocument } = setup();

    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(10, 10), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(20, 5), buttons: 1 });

    expect((runtime.getDraft() as PenShape | null)?.geometry).toEqual({
      type: "pen",
      points: [
        [-10, -5],
        [0, 5],
        [10, 0],
      ],
    });

    runtime.dispatch("pointerUp", { point: new Vec2(20, 5), buttons: 0 });

    expect(runtime.getDraft()).toBeNull();
    const shapeEntries = Object.entries(getDocument().shapes) as [
      string,
      PenShape,
    ][];
    expect(shapeEntries).toHaveLength(1);
    const [, shape] = shapeEntries[0];
    expect(shape.geometry.type).toBe("pen");
    expectPointsClose(getWorldPointsFromShape(shape), [
      [0, 0],
      [10, 10],
      [20, 5],
    ]);
  });

  test("uses destination-out compositeOp for eraser strokes", () => {
    const { runtime, getDocument } = setup();

    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(5, 5), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(5, 5), buttons: 0 });

    const shapeEntries = Object.values(getDocument().shapes);
    expect(shapeEntries).toHaveLength(1);
    expect(shapeEntries[0].style.stroke?.compositeOp).toBe("destination-out");
  });

  test("preserves explicit zero pressure samples", () => {
    const { runtime, getDocument } = setup();

    runtime.dispatch("pointerDown", {
      point: new Vec2(0, 0),
      buttons: 1,
      pressure: 0,
    });
    runtime.dispatch("pointerMove", {
      point: new Vec2(5, 5),
      buttons: 1,
      pressure: 0.3,
    });
    runtime.dispatch("pointerMove", {
      point: new Vec2(10, 10),
      buttons: 1,
      pressure: 0,
    });
    runtime.dispatch("pointerUp", { point: new Vec2(10, 10), buttons: 0 });

    const shapeEntries = Object.values(getDocument().shapes);
    expect(shapeEntries).toHaveLength(1);
    const shape = shapeEntries[0] as PenShape;
    expect(shape.geometry.type).toBe("pen");
    if (shape.geometry.type !== "pen") {
      throw new Error("Expected eraser geometry to use point-list format.");
    }
    expect(shape.geometry.pressures).toEqual([0, 0.3, 0]);
    expect(shape.geometry.points).toHaveLength(3);
  });

  test("deactivation clears drafts and prevents further commits", () => {
    const { runtime, getDocument, deactivate } = setup();

    runtime.dispatch("pointerDown", { point: new Vec2(1, 1), buttons: 1 });
    expect(runtime.getDraft()).not.toBeNull();

    deactivate?.();
    expect(runtime.getDraft()).toBeNull();

    runtime.dispatch("pointerMove", { point: new Vec2(2, 2), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(2, 2), buttons: 0 });
    expect(Object.values(getDocument().shapes)).toHaveLength(0);
  });

  test("keeps preview dirty bounds local to the recent stroke segment", () => {
    const { runtime } = setup();

    runtime.updateSharedSettings({
      strokeWidth: 4,
    });
    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    for (let x = 10; x <= 300; x += 10) {
      runtime.dispatch("pointerMove", { point: new Vec2(x, 0), buttons: 1 });
    }

    const preview = runtime.getPreview();
    expect(preview).not.toBeNull();
    expect(preview?.dirtyBounds).toBeDefined();
    const dirtyOps = new BoxOperations(preview!.dirtyBounds!);
    expect(dirtyOps.width).toBeLessThan(220);
  });
});
