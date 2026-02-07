import { describe, expect, test } from "bun:test";
import { createCanvas } from "canvas";
import type { AnyShape, RectGeometry } from "@smalldraw/core";
import { renderOrderedShapes } from "../index";

function pixelAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): [number, number, number, number] {
  const data = ctx.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

function rectShape(
  id: string,
  color: string,
  size: number,
): AnyShape & { geometry: RectGeometry } {
  return {
    id,
    type: "rect",
    zIndex: "a",
    geometry: { type: "rect", size: [size, size] },
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
    const red = rectShape("red", "#c62828", 14);
    const blue = rectShape("blue", "#1565c0", 10);

    const canvasA = createCanvas(20, 20);
    const ctxA = canvasA.getContext("2d") as unknown as CanvasRenderingContext2D;
    renderOrderedShapes(ctxA, [red, blue], { background: "#ffffff" });

    const canvasB = createCanvas(20, 20);
    const ctxB = canvasB.getContext("2d") as unknown as CanvasRenderingContext2D;
    renderOrderedShapes(ctxB, [blue, red], { background: "#ffffff" });

    expect(pixelAt(ctxA, 10, 10)).toEqual([21, 101, 192, 255]);
    expect(pixelAt(ctxB, 10, 10)).toEqual([198, 40, 40, 255]);
  });
});
