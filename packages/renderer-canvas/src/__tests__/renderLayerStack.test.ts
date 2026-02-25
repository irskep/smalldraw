import { describe, expect, test } from "bun:test";
import type { AnyShape, BoxedGeometry, DrawingLayer } from "@smalldraw/core";
import { createCanvas } from "canvas";
import { renderLayerStack } from "../document";
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
  layerId = "default",
): AnyShape & { geometry: BoxedGeometry } {
  return {
    id,
    type: "boxed",
    zIndex: "a",
    layerId,
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

function makeImageSource(
  color: string,
  width: number,
  height: number,
): CanvasImageSource {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas as unknown as CanvasImageSource;
}

describe("renderLayerStack", () => {
  test("renders drawing layer shapes", () => {
    const registry = createTestShapeRendererRegistry();
    const shape = boxedShape("s1", "#c62828", 14);
    const layers: DrawingLayer[] = [
      { id: "default", kind: "drawing", zIndex: "a0" },
    ];

    const canvas = createCanvas(20, 20);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 20, 20);

    renderLayerStack(ctx, layers, [shape], {
      registry,
      clear: false,
      resolveImage: () => null,
      documentWidth: 20,
      documentHeight: 20,
    });

    expect(pixelAt(ctx, 10, 10)).toEqual([198, 40, 40, 255]);
  });

  test("renders sticker drawing above image layer", () => {
    const registry = createTestShapeRendererRegistry();
    const defaultShape = boxedShape("fill", "#00ff00", 20, "default");
    const stickerShape = boxedShape("sticker", "#0000ff", 8, "sticker");
    const lineartImage = makeImageSource("#ff0000", 20, 20);
    const layers: DrawingLayer[] = [
      { id: "default", kind: "drawing", zIndex: "a0" },
      {
        id: "lineart",
        kind: "image",
        zIndex: "a1",
        image: { src: "lineart.png" },
      },
      { id: "sticker", kind: "drawing", zIndex: "a2" },
    ];

    const canvas = createCanvas(20, 20);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    renderLayerStack(ctx, layers, [defaultShape, stickerShape], {
      registry,
      resolveImage: (src: string) =>
        src === "lineart.png" ? lineartImage : null,
      documentWidth: 20,
      documentHeight: 20,
    });

    expect(pixelAt(ctx, 10, 10)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(ctx, 1, 1)).toEqual([255, 0, 0, 255]);
  });

  test("does not render shapes outside configured layers", () => {
    const registry = createTestShapeRendererRegistry();
    const shape = boxedShape("s1", "#c62828", 14, "sticker");
    const layers: DrawingLayer[] = [
      { id: "default", kind: "drawing", zIndex: "a0" },
    ];

    const canvas = createCanvas(20, 20);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 20, 20);

    renderLayerStack(ctx, layers, [shape], {
      registry,
      clear: false,
      resolveImage: () => null,
      documentWidth: 20,
      documentHeight: 20,
    });

    expect(pixelAt(ctx, 10, 10)).toEqual([255, 255, 255, 255]);
  });

  test("renders image below drawing layers", () => {
    const registry = createTestShapeRendererRegistry();
    const shape = boxedShape("s1", "#0000ff", 8, "default");
    const bgImage = makeImageSource("#ff0000", 20, 20);
    const layers: DrawingLayer[] = [
      {
        id: "background",
        kind: "image",
        zIndex: "a0",
        image: { src: "bg.png" },
      },
      { id: "default", kind: "drawing", zIndex: "a1" },
      { id: "sticker", kind: "drawing", zIndex: "a2" },
    ];

    const canvas = createCanvas(20, 20);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    renderLayerStack(ctx, layers, [shape], {
      registry,
      resolveImage: (src: string) => (src === "bg.png" ? bgImage : null),
      documentWidth: 20,
      documentHeight: 20,
    });

    expect(pixelAt(ctx, 10, 10)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(ctx, 1, 1)).toEqual([255, 0, 0, 255]);
  });
});
