import { describe, expect, test } from "bun:test";
import { ClearCanvas } from "../clearCanvas";
import { AddShape } from "../addShape";
import { DrawingStore } from "../../store/drawingStore";
import type { RectGeometry } from "../../model/shapes/rectShape";
import { getOrderedShapes } from "../../zindex";

const v = (x = 0, y = x): [number, number] => [x, y];

function createRectShape(id: string) {
  return {
    id,
    type: "rect",
    zIndex: "a",
    geometry: { type: "rect", size: v(10, 10) } as RectGeometry,
    style: { fill: { type: "solid" as const, color: "#000000" } },
  };
}

function createClearShape(id: string, zIndex: string) {
  return {
    id,
    type: "clear",
    zIndex,
    geometry: { type: "clear" as const },
    style: {},
  };
}

describe("ClearCanvas", () => {
  test("filters shapes with temporalOrder at or below the clear", () => {
    const store = new DrawingStore({ tools: [] });
    store.applyAction(new AddShape(createRectShape("rect-1")));
    store.applyAction(new AddShape(createRectShape("rect-2")));

    const beforeClear = getOrderedShapes(store.getDocument()).map(
      (shape) => shape.id,
    );
    expect(beforeClear).toEqual(["rect-1", "rect-2"]);

    store.applyAction(new ClearCanvas(createClearShape("clear-1", "c")));
    const afterClear = getOrderedShapes(store.getDocument());
    expect(afterClear).toEqual([]);

    store.undo();
    const afterUndo = getOrderedShapes(store.getDocument()).map(
      (shape) => shape.id,
    );
    expect(afterUndo).toEqual(["rect-1", "rect-2"]);
  });
});
