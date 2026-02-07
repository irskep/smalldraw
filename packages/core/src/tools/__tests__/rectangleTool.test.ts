import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import { Vec2 } from "gl-matrix";
import { AddShape } from "../../actions";
import { createDocument } from "../../model/document";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { RectGeometry, RectShape } from "../../model/shapes/rectShape";
import { UndoManager } from "../../undo";
import { createRectangleTool } from "../rectangle";
import { ToolRuntimeImpl } from "../runtime";
import type { SharedToolSettings } from "../types";

function setup(params?: { sharedSettings?: SharedToolSettings }) {
  const registry = getDefaultShapeHandlerRegistry();
  let document = createDocument(undefined, registry);
  const undoManager = new UndoManager();
  const runtime = new ToolRuntimeImpl({
    toolId: "rect",
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
  const tool = createRectangleTool();
  tool.activate(runtime);
  return { runtime, getDocument: () => document, tool };
}

describe("rectangle tool", () => {
  test("creates rectangle geometry from pointer drag", () => {
    const { runtime, getDocument } = setup();
    runtime.dispatch("pointerDown", { point: new Vec2(10, 10), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(30, 40), buttons: 1 });

    const draft = runtime.getDraft() as RectShape | null;
    expect(draft?.geometry).toEqual({
      type: "rect",
      size: [20, 30],
    });

    runtime.dispatch("pointerUp", { point: new Vec2(30, 40), buttons: 0 });
    expect(Object.values(getDocument().shapes)).toHaveLength(1);
    const shape = Object.values(getDocument().shapes)[0] as RectShape;
    expect(draft).toBeDefined();
    expect(shape.geometry).toEqual(draft!.geometry);
    expect(shape.transform?.translation).toEqual([20, 25]);
    expect(shape.interactions?.resizable).toBe(true);
  });

  test("uses shared fill color by default", () => {
    const shared: SharedToolSettings = {
      strokeColor: "#111111",
      strokeWidth: 4,
      fillColor: "#abcdef",
    };
    const { runtime, getDocument } = setup({ sharedSettings: shared });
    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(10, 10), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(10, 10), buttons: 0 });

    const shape = Object.values(getDocument().shapes)[0];
    expect(shape.style.fill?.type).toBe("solid");
    if (shape.style.fill?.type === "solid") {
      expect(shape.style.fill.color).toBe("#abcdef");
    }
    expect(shape.style.stroke?.color).toBe("#111111");
    expect(shape.style.stroke?.size).toBe(4);
  });

  test("does not reuse an existing shape id", () => {
    const { runtime, getDocument } = setup();
    const existingShapeId = "rect-1";
    runtime.commit(
      new AddShape({
        id: existingShapeId,
        type: "rect",
        geometry: { type: "rect", size: [10, 10] } as RectGeometry,
        style: { fill: { type: "solid", color: "#ffffff" } },
        zIndex: "a0",
        transform: { translation: [0, 0], scale: [1, 1], rotation: 0 },
      }),
    );

    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(10, 10), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(10, 10), buttons: 0 });

    const shapes = Object.values(getDocument().shapes);
    expect(shapes).toHaveLength(2);
    const ids = new Set(shapes.map((shape) => shape.id));
    expect(ids.has(existingShapeId)).toBe(true);
    expect(ids.size).toBe(2);
  });
});
