import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import { BoxOperations } from "@smalldraw/geometry";
import { expectPointsClose, getWorldPointsFromShape } from "@smalldraw/testing";
import { Vec2 } from "gl-matrix";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { PenShape } from "../../model/shapes/penShape";
import { UndoManager } from "../../undo";
import { createMarkerTool } from "../marker";
import { ToolRuntimeImpl } from "../runtime";
import type { SharedToolSettings } from "../types";

describe("marker tool integration with runtime", () => {
  function setup(params?: { sharedSettings?: SharedToolSettings }) {
    const registry = getDefaultShapeHandlerRegistry();
    let document = createDocument(undefined, registry);
    const undoManager = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: "marker",
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
    const tool = createMarkerTool();
    const deactivate = tool.activate(runtime);
    return { runtime, getDocument: () => document, deactivate };
  }

  test("collects pointer events and commits marker strokes", () => {
    const { runtime, getDocument } = setup();

    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(10, 10), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(20, 5), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(20, 5), buttons: 0 });

    const shapeEntries = Object.entries(getDocument().shapes) as [
      string,
      PenShape,
    ][];
    expect(shapeEntries).toHaveLength(1);
    const [, shape] = shapeEntries[0];
    expect(shape.id.startsWith("marker-")).toBeTrue();
    expect(shape.style.stroke?.brushId).toBe("marker");
    expect(shape.style.stroke?.compositeOp).toBe("source-over");
    expectPointsClose(getWorldPointsFromShape(shape), [
      [0, 0],
      [10, 10],
      [20, 5],
    ]);
  });

  test("falls back to shared settings for size and color", () => {
    const shared: SharedToolSettings = {
      strokeColor: "#34a853",
      strokeWidth: 9,
      fillColor: "#ffffff",
    };
    const { runtime, getDocument } = setup({ sharedSettings: shared });
    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(4, 3), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(4, 3), buttons: 0 });

    const shape = Object.values(getDocument().shapes)[0];
    expect(shape.style.stroke?.color).toBe("#34a853");
    expect(shape.style.stroke?.size).toBe(9);
    expect(shape.style.stroke?.brushId).toBe("marker");
  });

  test("keeps preview dirty bounds local to the recent segment", () => {
    const { runtime } = setup({
      sharedSettings: {
        strokeColor: "#000000",
        strokeWidth: 4,
        fillColor: "#ffffff",
      },
    });

    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    for (let x = 10; x <= 300; x += 10) {
      runtime.dispatch("pointerMove", { point: new Vec2(x, 0), buttons: 1 });
    }

    const preview = runtime.getPreview();
    expect(preview).not.toBeNull();
    const dirtyOps = new BoxOperations(preview!.dirtyBounds!);
    expect(dirtyOps.width).toBeLessThan(220);
  });
});
