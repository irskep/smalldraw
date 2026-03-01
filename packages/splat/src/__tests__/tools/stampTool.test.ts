import { describe, expect, test } from "bun:test";
import { change } from "@automerge/automerge/slim";
import {
  type AnyShape,
  createDocument,
  type SharedToolSettings,
  ToolRuntimeImpl,
  UndoManager,
} from "@smalldraw/core";
import { Vec2 } from "gl-matrix";
import { createKidsShapeHandlerRegistry } from "../../shapes/kidsShapeHandlers";
import { createAlphabetStampTool } from "../../tools/drawingTools";

describe("alphabet stamp tool", () => {
  function setup(params?: { sharedSettings?: SharedToolSettings }) {
    const registry = createKidsShapeHandlerRegistry();
    let document = createDocument(undefined, registry);
    const undoManager = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: "stamp.letter.a",
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

    const tool = createAlphabetStampTool({ letter: "A" });
    tool.activate(runtime);

    return { runtime, getDocument: () => document, tool };
  }

  test("stamps a multi-stroke letter at pointer up", () => {
    const { runtime, getDocument } = setup();

    runtime.dispatch("pointerDown", { point: new Vec2(120, 80), buttons: 1 });
    expect(Object.values(getDocument().shapes)).toHaveLength(0);
    runtime.dispatch("pointerUp", { point: new Vec2(120, 80), buttons: 0 });

    const shapes = Object.values(getDocument().shapes) as AnyShape[];
    expect(shapes.length).toBe(1);
    for (const shape of shapes) {
      expect(shape.type).toBe("stamp");
      expect(shape.geometry.type).toBe("stamp");
      expect(shape.style.stroke?.compositeOp).toBe("source-over");
    }
  });

  test("supports drag-to-rotate-and-scale before commit", () => {
    const { runtime, getDocument } = setup();

    runtime.dispatch("pointerDown", { point: new Vec2(100, 80), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(128, 80), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(128, 80), buttons: 0 });

    const shapes = Object.values(getDocument().shapes) as AnyShape[];
    expect(shapes.length).toBe(1);
    const shape = shapes[0]!;
    expect(shape.transform?.translation).toEqual([100, 80]);
    expect(shape.transform?.rotation ?? 0).toBe(0);
    expect((shape.transform?.scale?.[0] ?? 1) > 1).toBeTrue();
    expect((shape.transform?.scale?.[1] ?? 1) > 1).toBeTrue();
  });

  test("uses shared stroke settings", () => {
    const { runtime, getDocument } = setup({
      sharedSettings: {
        strokeColor: "#2e86ff",
        strokeWidth: 5,
        fillColor: "#ffffff",
      },
    });

    runtime.dispatch("pointerDown", { point: new Vec2(60, 40), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(60, 40), buttons: 0 });

    const shapes = Object.values(getDocument().shapes) as AnyShape[];
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape.style.stroke?.color).toBe("#2e86ff");
      expect(shape.style.stroke?.size).toBe(7.5);
    }
  });

  test("declares stroke-only style support", () => {
    const tool = createAlphabetStampTool({ letter: "Z" });
    expect(tool.styleSupport).toEqual({
      strokeColor: true,
      strokeWidth: true,
      fillColor: false,
      transparentStrokeColor: false,
      transparentFillColor: false,
    });
  });
});
