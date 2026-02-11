import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import { getWorldPointsFromShape } from "@smalldraw/testing";
import { Vec2 } from "gl-matrix";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { PenShape } from "../../model/shapes/penShape";
import { UndoManager } from "../../undo";
import { createSprayTool } from "../drawingTools";
import { ToolRuntimeImpl } from "../runtime";

describe("spray tool integration with runtime", () => {
  function setup() {
    const registry = getDefaultShapeHandlerRegistry();
    let document = createDocument(undefined, registry);
    const undoManager = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: "brush.spray",
      getDocument: () => document,
      commitAction: (action) => {
        document = undoManager.apply(action, document, {
          registry,
          change: (next, update) => change(next, update),
        });
      },
      shapeHandlers: registry,
    });
    const tool = createSprayTool();
    const deactivate = tool.activate(runtime);
    return { runtime, getDocument: () => document, deactivate };
  }

  test("stores generated spray dots directly in geometry", () => {
    const { runtime, getDocument } = setup();

    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(10, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(20, 0), buttons: 1 });

    const draft = runtime.getDraft() as PenShape | null;
    expect(draft).not.toBeNull();
    expect(draft!.geometry.points.length).toBeGreaterThan(8);

    runtime.dispatch("pointerUp", { point: new Vec2(20, 0), buttons: 0 });

    const shapeEntries = Object.values(getDocument().shapes) as PenShape[];
    expect(shapeEntries).toHaveLength(1);
    const shape = shapeEntries[0];
    expect(shape.style.stroke?.brushId).toBe("spray");

    const worldPoints = getWorldPointsFromShape(shape);
    expect(worldPoints.length).toBe(draft!.geometry.points.length);
    const bounds = worldPoints.reduce(
      (acc, point) => ({
        minX: Math.min(acc.minX, point[0]),
        maxX: Math.max(acc.maxX, point[0]),
        minY: Math.min(acc.minY, point[1]),
        maxY: Math.max(acc.maxY, point[1]),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    );
    expect(bounds.maxX).toBeGreaterThan(8);
    expect(bounds.minX).toBeLessThan(2);
  });

  test("commits a spray stroke from tap-only input", () => {
    const { runtime, getDocument } = setup();

    runtime.dispatch("pointerDown", { point: new Vec2(30, 40), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(30, 40), buttons: 0 });

    const shapeEntries = Object.values(getDocument().shapes) as PenShape[];
    expect(shapeEntries).toHaveLength(1);
    expect(shapeEntries[0]!.geometry.points.length).toBeGreaterThan(0);
  });
});
