import { describe, expect, test } from "bun:test";
import type { BoxedGeometry } from "../../model/shapes/boxedShape";
import { DrawingStore } from "../../store/drawingStore";
import { getOrderedShapes } from "../../zindex";
import { AddShape } from "../addShape";
import { ClearCanvas } from "../clearCanvas";

const v = (x = 0, y = x): [number, number] => [x, y];

function createBoxedShape(id: string) {
  return {
    id,
    type: "boxed",
    zIndex: "a",
    geometry: { type: "boxed", kind: "rect", size: v(10, 10) } as BoxedGeometry,
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
    store.applyAction(new AddShape(createBoxedShape("rect-1")));
    store.applyAction(new AddShape(createBoxedShape("rect-2")));

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
