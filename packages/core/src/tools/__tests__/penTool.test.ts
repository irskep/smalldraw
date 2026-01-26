import { describe, expect, test } from "bun:test";
import { makePoint } from "@smalldraw/geometry";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { PenShape } from "../../model/shapes/penShape";
import { UndoManager } from "../../undo";
import { createPenTool } from "../pen";
import { ToolRuntimeImpl } from "../runtime";
import type { SharedToolSettings } from "../types";

describe("pen tool integration with runtime", () => {
  function setup(params?: {
    runtimeStrokeColor?: string;
    sharedSettings?: SharedToolSettings;
  }) {
    const registry = getDefaultShapeHandlerRegistry();
    const document = createDocument(undefined, registry);
    const undoManager = new UndoManager();
    const runtimeOptions = params?.runtimeStrokeColor
      ? { stroke: { type: "brush", color: params.runtimeStrokeColor, size: 5 } }
      : undefined;
    const runtime = new ToolRuntimeImpl({
      toolId: "pen",
      document,
      undoManager,
      shapeHandlers: registry,
      options: runtimeOptions,
      sharedSettings: params?.sharedSettings,
    });
    const tool = createPenTool();
    const deactivate = tool.activate(runtime);
    return { runtime, document, undoManager, tool, deactivate };
  }

  test("collects pointer events into draft stroke and commits at pointer up", () => {
    const { runtime, document } = setup();

    runtime.dispatch("pointerDown", { point: makePoint(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: makePoint(10, 10), buttons: 1 });
    runtime.dispatch("pointerMove", { point: makePoint(20, 5), buttons: 1 });

    expect((runtime.getDraft() as PenShape | null)?.geometry).toEqual({
      type: "pen",
      points: [makePoint(-10, -5), makePoint(0, 5), makePoint(10, 0)],
    });

    runtime.dispatch("pointerUp", { point: makePoint(20, 5), buttons: 0 });

    expect(runtime.getDraft()).toBeNull();
    const shapeEntries = Object.entries(document.shapes) as [
      string,
      PenShape,
    ][];
    expect(shapeEntries).toHaveLength(1);
    const [, shape] = shapeEntries[0];
    expect(shape.geometry).toEqual({
      type: "pen",
      points: [makePoint(-10, -5), makePoint(0, 5), makePoint(10, 0)],
    });
    expect(shape.transform?.translation).toEqual(makePoint(10, 5));
  });

  test("uses runtime stroke options when provided", () => {
    const { runtime, document } = setup({ runtimeStrokeColor: "#ff00ff" });

    runtime.dispatch("pointerDown", { point: makePoint(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: makePoint(5, 5), buttons: 1 });
    runtime.dispatch("pointerUp", { point: makePoint(5, 5), buttons: 0 });

    const shapeEntries = Object.values(document.shapes);
    expect(shapeEntries).toHaveLength(1);
    expect(shapeEntries[0].stroke?.color).toBe("#ff00ff");
  });

  test("falls back to shared settings for stroke defaults", () => {
    const shared: SharedToolSettings = {
      strokeColor: "#00ff00",
      strokeWidth: 7,
      fillColor: "#ffffff",
    };
    const { runtime, document } = setup({ sharedSettings: shared });
    runtime.dispatch("pointerDown", { point: makePoint(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: makePoint(2, 2), buttons: 1 });
    runtime.dispatch("pointerUp", { point: makePoint(2, 2), buttons: 0 });

    const shape = Object.values(document.shapes)[0];
    expect(shape.stroke?.color).toBe("#00ff00");
    expect(shape.stroke?.size).toBe(7);
    expect(runtime.getSharedSettings().strokeWidth).toBe(7);
  });

  test("deactivation clears drafts and prevents further commits", () => {
    const { runtime, document, deactivate } = setup();

    runtime.dispatch("pointerDown", { point: makePoint(1, 1), buttons: 1 });
    expect(runtime.getDraft()).not.toBeNull();

    deactivate?.();
    expect(runtime.getDraft()).toBeNull();

    runtime.dispatch("pointerMove", { point: makePoint(2, 2), buttons: 1 });
    runtime.dispatch("pointerUp", { point: makePoint(2, 2), buttons: 0 });
    expect(Object.values(document.shapes)).toHaveLength(0);
  });
});
