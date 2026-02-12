import { describe, expect, test } from "bun:test";
import type { AnyShape, BoxedGeometry } from "@smalldraw/core";
import { createCanvas } from "canvas";
import { renderOrderedShapes } from "../index";
import { createTestShapeRendererRegistry } from "./testShapeRendererRegistry";

function pixelAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): [number, number, number, number] {
  const data = ctx.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

function boxedShape(
  id: string,
  color: string,
  size: number,
): AnyShape & { geometry: BoxedGeometry } {
  return {
    id,
    type: "boxed",
    zIndex: "a",
    geometry: { type: "boxed", kind: "rect", size: [size, size] },
    transform: {
      translation: [10, 10],
    },
    style: {
      fill: { type: "solid", color },
      stroke: { type: "brush", color, size: 2 },
    },
  };
}

describe("renderOrderedShapes", () => {
  test("renders shapes in provided order", () => {
    const registry = createTestShapeRendererRegistry();
    const red = boxedShape("red", "#c62828", 14);
    const blue = boxedShape("blue", "#1565c0", 10);

    const canvasA = createCanvas(20, 20);
    const ctxA = canvasA.getContext(
      "2d",
    ) as unknown as CanvasRenderingContext2D;
    ctxA.fillStyle = "#ffffff";
    ctxA.fillRect(0, 0, 20, 20);
    renderOrderedShapes(ctxA, [red, blue], { registry });

    const canvasB = createCanvas(20, 20);
    const ctxB = canvasB.getContext(
      "2d",
    ) as unknown as CanvasRenderingContext2D;
    ctxB.fillStyle = "#ffffff";
    ctxB.fillRect(0, 0, 20, 20);
    renderOrderedShapes(ctxB, [blue, red], { registry });

    expect(pixelAt(ctxA, 10, 10)).toEqual([21, 101, 192, 255]);
    expect(pixelAt(ctxB, 10, 10)).toEqual([198, 40, 40, 255]);
  });
});
