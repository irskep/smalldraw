import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import {
  createDocument,
  getPenGeometryPoints,
  type PenShape,
  type SharedToolSettings,
  ToolRuntimeImpl,
  UndoManager,
} from "@smalldraw/core";
import { expectPointsClose, getWorldPointsFromShape } from "@smalldraw/testing";
import { Vec2 } from "gl-matrix";
import { createKidsShapeHandlerRegistry } from "../../shapes/kidsShapeHandlers";
import { createLineTool } from "../../tools/drawingTools";

describe("line tool integration with runtime", () => {
  function setup(params?: { sharedSettings?: SharedToolSettings }) {
    const registry = createKidsShapeHandlerRegistry();
    let document = createDocument(undefined, registry);
    const undoManager = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: "line",
      getDocument: () => document,
      commitAction: (action) => {
        document = undoManager.apply(action, document, {
          registry,
          change: (next, update) => change(next, update),
        });
      },
      shapeHandlers: registry,
      sharedSettings: params?.sharedSettings,
    });
    const tool = createLineTool();
    const deactivate = tool.activate(runtime);
    return { runtime, getDocument: () => document, deactivate };
  }

  test("commits a two-point pen shape from drag", () => {
    const { runtime, getDocument } = setup();

    runtime.dispatch("pointerDown", { point: new Vec2(10, 10), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(70, 42), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(70, 42), buttons: 0 });

    const shapes = Object.values(getDocument().shapes) as PenShape[];
    expect(shapes).toHaveLength(1);
    const shape = shapes[0]!;
    expect(shape.type).toBe("pen");
    expect(shape.style.stroke?.brushId).toBe("marker");
    expect(getPenGeometryPoints(shape.geometry)).toHaveLength(2);
    expectPointsClose(getWorldPointsFromShape(shape), [
      [10, 10],
      [70, 42],
    ]);
  });

  test("uses shared stroke color and width", () => {
    const { runtime, getDocument } = setup({
      sharedSettings: {
        strokeColor: "#ff4d6d",
        strokeWidth: 11,
        fillColor: "#ffffff",
      },
    });

    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(20, 0), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(20, 0), buttons: 0 });

    const shape = Object.values(getDocument().shapes)[0] as PenShape;
    expect(shape.style.stroke?.color).toBe("#ff4d6d");
    expect(shape.style.stroke?.size).toBe(11);
  });

  test("declares stroke-only style support", () => {
    const tool = createLineTool();
    expect(tool.styleSupport).toEqual({
      strokeColor: true,
      strokeWidth: true,
      fillColor: false,
      transparentStrokeColor: false,
      transparentFillColor: false,
    });
  });
});
