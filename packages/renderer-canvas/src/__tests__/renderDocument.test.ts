import { describe, expect, test } from "bun:test";
import {
  createDocument,
  getDefaultShapeHandlerRegistry,
} from "@smalldraw/core";
import { createCanvas } from "canvas";
import { renderDocument } from "../index";

function pixelAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): [number, number, number, number] {
  const data = ctx.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

describe("renderDocument", () => {
  test("leaves canvas transparent by default", () => {
    const canvas = createCanvas(20, 20);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    const registry = getDefaultShapeHandlerRegistry();
    const document = createDocument(undefined, registry);
    renderDocument(ctx, document);
    expect(pixelAt(ctx, 10, 10)).toEqual([0, 0, 0, 0]);
  });
});
