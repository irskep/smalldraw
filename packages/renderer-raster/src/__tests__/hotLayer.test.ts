import { describe, expect, test } from "bun:test";
import { createCanvas } from "canvas";
import type { DraftShape, RectGeometry } from "@smalldraw/core";
import { Vec2 } from "gl-matrix";
import { HotLayer } from "../hotLayer";

function pixelAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): [number, number, number, number] {
  const data = ctx.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

const v = (x = 0, y = x): [number, number] => [x, y];

function draftRect(
  id: string,
  translation: [number, number],
  color: string,
): DraftShape {
  return {
    id,
    type: "rect",
    zIndex: "a",
    geometry: { type: "rect", size: v(40, 30) } as RectGeometry,
    transform: { translation },
    style: { fill: { type: "solid", color } },
    toolId: "pen",
    temporary: true,
  };
}

describe("HotLayer", () => {
  test("renders drafts in screen space and clears on request", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement);
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(0, 0),
      scale: 1,
    });

    const draft = draftRect("draft-1", [0, 0], "#ff0000");
    hotLayer.renderDrafts([draft]);

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(ctx, 100, 100)).toEqual([255, 0, 0, 255]);

    hotLayer.clear();
    expect(pixelAt(ctx, 100, 100)[3]).toBe(0);
  });

  test("applies viewport center shift", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement);
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(50, 0),
      scale: 1,
    });

    const draft = draftRect("draft-2", [0, 0], "#00ff00");
    hotLayer.renderDrafts([draft]);

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(ctx, 100, 100)[3]).toBe(0);
    expect(pixelAt(ctx, 50, 100)).toEqual([0, 255, 0, 255]);
  });

  test("respects z-index ordering for overlapping drafts", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement);
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(0, 0),
      scale: 1,
    });

    const red = {
      ...draftRect("draft-1", [0, 0], "#ff0000"),
      zIndex: "a",
    };
    const blue = {
      ...draftRect("draft-2", [0, 0], "#0000ff"),
      zIndex: "b",
    };
    hotLayer.renderDrafts([red, blue]);

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(ctx, 100, 100)).toEqual([0, 0, 255, 255]);
  });

  test("applies viewport scale", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement);
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(0, 0),
      scale: 2,
    });

    const draft = draftRect("draft-3", [0, 0], "#00ffff");
    hotLayer.renderDrafts([draft]);

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(ctx, 100, 100)).toEqual([0, 255, 255, 255]);
    expect(pixelAt(ctx, 50, 100)[3]).toBe(0);
  });

  test("clears when rendering empty drafts", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement);
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(0, 0),
      scale: 1,
    });

    const draft = draftRect("draft-4", [0, 0], "#ff00ff");
    hotLayer.renderDrafts([draft]);
    hotLayer.renderDrafts([]);

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(ctx, 100, 100)[3]).toBe(0);
  });
});
