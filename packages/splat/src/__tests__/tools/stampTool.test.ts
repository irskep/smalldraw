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
import type { StampShape } from "../../shapes/stampShape";
import { createAlphabetStampTool } from "../../tools/drawingTools";
import { computeStampSize } from "../../tools/stampTool";

describe("alphabet stamp tool", () => {
  function setup(params?: {
    sharedSettings?: SharedToolSettings;
    height?: number;
  }) {
    const registry = createKidsShapeHandlerRegistry();
    let document = createDocument(undefined, registry, {
      width: 960,
      height: params?.height ?? 600,
    });
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

  for (const width of [2, 8, 200]) {
    for (const [dx, dy] of [
      [40, 0],
      [0, 40],
      [-40, 0],
      [0, -40],
    ]) {
      test(`rotates from initial direction ${dx},${dy} without resizing at width ${width}`, () => {
        const { runtime, getDocument } = setup({
          sharedSettings: {
            strokeColor: "#000000",
            strokeWidth: width,
            fillColor: "#ffffff",
          },
        });
        runtime.dispatch("pointerDown", {
          point: new Vec2(100, 100),
          buttons: 1,
        });
        runtime.dispatch("pointerMove", {
          point: new Vec2(100 + dx!, 100 + dy!),
          buttons: 1,
        });
        runtime.dispatch("pointerMove", {
          point: new Vec2(100 - dy!, 100 + dx!),
          buttons: 1,
        });
        runtime.dispatch("pointerUp", {
          point: new Vec2(100 - dy!, 100 + dx!),
          buttons: 0,
        });
        const shape = Object.values(getDocument().shapes)[0]!;
        expect(shape.transform?.scale).toEqual([1, 1]);
        expect(shape.transform?.rotation).toBeCloseTo(Math.PI / 2);
        expect(shape.transform?.translation).toEqual([100, 100]);
        expect((shape as StampShape).geometry.height).toBe(
          computeStampSize(width, getDocument().size.height),
        );
      });
    }
  }

  test("a straight drag in any direction leaves the stamp upright", () => {
    for (const [dx, dy] of [
      [40, 0],
      [0, 40],
      [-40, 0],
      [0, -40],
    ]) {
      const { runtime, getDocument } = setup();
      runtime.dispatch("pointerDown", {
        point: new Vec2(100, 100),
        buttons: 1,
      });
      runtime.dispatch("pointerMove", {
        point: new Vec2(100 + dx!, 100 + dy!),
        buttons: 1,
      });
      runtime.dispatch("pointerMove", {
        point: new Vec2(100 + dx! * 2, 100 + dy! * 2),
        buttons: 1,
      });
      runtime.dispatch("pointerUp", {
        point: new Vec2(100 + dx! * 2, 100 + dy! * 2),
        buttons: 0,
      });
      const shape = Object.values(getDocument().shapes)[0]!;
      expect(shape.transform?.rotation).toBe(0);
      expect(shape.transform?.scale).toEqual([1, 1]);
    }
  });

  test("ignores finger jitter and keeps rotation when returning to the center", () => {
    const { runtime, getDocument } = setup();
    runtime.dispatch("pointerDown", { point: new Vec2(100, 100), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(102, 103), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(100, 60), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(140, 100), buttons: 1 });
    runtime.dispatch("pointerMove", { point: new Vec2(100, 100), buttons: 1 });
    runtime.dispatch("pointerUp", { point: new Vec2(100, 100), buttons: 0 });
    const shape = Object.values(getDocument().shapes)[0]!;
    expect(shape.transform?.rotation).toBeCloseTo(Math.PI / 2);
    expect(shape.transform?.scale).toEqual([1, 1]);
  });

  for (const height of [20, 300, 1195]) {
    test(`caps large stamps to drawing height ${height} without thickening letters`, () => {
      const { runtime, getDocument } = setup({
        height,
        sharedSettings: {
          strokeColor: "#000000",
          strokeWidth: 200,
          fillColor: "#ffffff",
        },
      });
      runtime.dispatch("pointerDown", {
        point: new Vec2(100, 100),
        buttons: 1,
      });
      runtime.dispatch("pointerUp", { point: new Vec2(100, 100), buttons: 0 });
      const shape = Object.values(getDocument().shapes)[0] as StampShape;
      expect(shape.geometry.height).toBe(height);
      expect(shape.style.stroke?.size).toBeCloseTo(height / 10);
    });
  }

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
      expect(shape.style.stroke?.size).toBeCloseTo(
        computeStampSize(5, 600) / 10,
      );
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

for (const height of [20, 300, 600, 1195, 2400]) {
  test(`all stamp choices remain distinct at drawing height ${height}`, () => {
    const sizes = [2, 4, 8, 16, 24, 48, 96, 200].map((width) =>
      computeStampSize(width, height),
    );
    expect(sizes[0]).toBe(Math.min(30, height / 4));
    expect(sizes.at(-1)).toBeCloseTo(height);
    for (let i = 1; i < sizes.length; i++)
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]!);
  });
}
