import { describe, expect, test } from "bun:test";
import { makePoint } from "@smalldraw/geometry";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { RectShape } from "../../model/shapes/rectShape";
import { UndoManager } from "../../undo";
import { createRectangleTool } from "../rectangle";
import { ToolRuntimeImpl } from "../runtime";
import type { SharedToolSettings } from "../types";

function setup(params?: { sharedSettings?: SharedToolSettings }) {
  const registry = getDefaultShapeHandlerRegistry();
  const document = createDocument(undefined, registry);
  const undoManager = new UndoManager();
  const runtime = new ToolRuntimeImpl({
    toolId: "rect",
    document,
    undoManager,
    shapeHandlers: registry,
    sharedSettings: params?.sharedSettings,
  });
  const tool = createRectangleTool();
  tool.activate(runtime);
  return { runtime, document, tool };
}

describe("rectangle tool", () => {
  test("creates rectangle geometry from pointer drag", () => {
    const { runtime, document } = setup();
    runtime.dispatch("pointerDown", { point: makePoint(10, 10), buttons: 1 });
    runtime.dispatch("pointerMove", { point: makePoint(30, 40), buttons: 1 });

    const draft = runtime.getDraft() as RectShape | null;
    expect(draft?.geometry).toEqual({
      type: "rect",
      size: makePoint(20, 30),
    });

    runtime.dispatch("pointerUp", { point: makePoint(30, 40), buttons: 0 });
    expect(Object.values(document.shapes)).toHaveLength(1);
    const shape = Object.values(document.shapes)[0] as RectShape;
    expect(draft).toBeDefined();
    expect(shape.geometry).toEqual(draft!.geometry);
    expect(shape.transform?.translation).toEqual(makePoint(20, 25));
    expect(shape.interactions?.resizable).toBe(true);
  });

  test("uses shared fill color by default", () => {
    const shared: SharedToolSettings = {
      strokeColor: "#111111",
      strokeWidth: 4,
      fillColor: "#abcdef",
    };
    const { runtime, document } = setup({ sharedSettings: shared });
    runtime.dispatch("pointerDown", { point: makePoint(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: makePoint(10, 10), buttons: 1 });
    runtime.dispatch("pointerUp", { point: makePoint(10, 10), buttons: 0 });

    const shape = Object.values(document.shapes)[0];
    expect(shape.fill?.type).toBe("solid");
    if (shape.fill?.type === "solid") {
      expect(shape.fill.color).toBe("#abcdef");
    }
    expect(shape.stroke?.color).toBe("#111111");
    expect(shape.stroke?.size).toBe(4);
  });
});
