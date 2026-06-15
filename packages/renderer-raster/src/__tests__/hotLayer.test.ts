import { describe, expect, test } from "bun:test";
import {
  type BoxedGeometry,
  createPenJSONGeometry,
  type DraftShape,
} from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import { createCanvas } from "canvas";
import { Vec2 } from "gl-matrix";
import { HotLayer } from "../hotLayer";
import { createTestShapeRendererRegistry } from "./testShapeRendererRegistry";

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
    type: "boxed",
    zIndex: "a",
    geometry: { type: "boxed", kind: "rect", size: v(40, 30) } as BoxedGeometry,
    transform: { translation },
    style: { fill: { type: "solid", color } },
    toolId: "brush.freehand",
    temporary: true,
  };
}

function draftPen(
  id: string,
  points: Array<[number, number]>,
  compositeOp: "source-over" | "destination-out",
): DraftShape {
  return {
    id,
    type: "pen",
    zIndex: "a",
    geometry: createPenJSONGeometry(points),
    style: {
      stroke: {
        type: "brush",
        color: "#000000",
        size: 24,
        brushId: "marker",
        compositeOp,
      },
    },
    toolId: "eraser.basic",
    temporary: true,
  };
}

function solidCanvas(
  width: number,
  height: number,
  color: string,
): CanvasImageSource {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas as unknown as CanvasImageSource;
}

const box = (min: [number, number], max: [number, number]): Box => ({
  min,
  max,
});

describe("HotLayer", () => {
  const shapeRendererRegistry = createTestShapeRendererRegistry();

  test("renders drafts in screen space and clears on request", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
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
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
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
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
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
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
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
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
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

  test("clips redraw to dirty bounds", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(0, 0),
      scale: 1,
    });

    const left = draftRect("left", [-40, 0], "#ff0000");
    const right = draftRect("right", [40, 0], "#0000ff");
    hotLayer.renderDrafts([left, right]);

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    const baselineLeft = pixelAt(ctx, 60, 100);
    const baselineRight = pixelAt(ctx, 140, 100);
    expect(baselineLeft).toEqual([255, 0, 0, 255]);
    expect(baselineRight).toEqual([0, 0, 255, 255]);

    hotLayer.renderDrafts([right], {
      dirtyBounds: box([20, -20], [80, 20]),
    });
    expect(pixelAt(ctx, 60, 100)).toEqual(baselineLeft);
    expect(pixelAt(ctx, 140, 100)).toEqual([0, 0, 255, 255]);
  });

  test("maps dirty backdrop blits across different source/backing resolutions", () => {
    const canvas = createCanvas(400, 400);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(100, 100),
      scale: 1,
    });

    const backdrop = createCanvas(200, 200);
    const backdropCtx = backdrop.getContext("2d");
    backdropCtx.fillStyle = "#ff0000";
    backdropCtx.fillRect(0, 0, 100, 200);
    backdropCtx.fillStyle = "#0000ff";
    backdropCtx.fillRect(100, 0, 100, 200);
    hotLayer.setDraftComposite({
      below: null,
      active: backdrop as unknown as CanvasImageSource,
      above: null,
    });

    hotLayer.renderDrafts([], {
      dirtyBounds: box([100, 0], [200, 200]),
    });

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(ctx, 100, 200)[3]).toBe(0);
    expect(pixelAt(ctx, 300, 200)).toEqual([0, 0, 255, 255]);
  });

  test("composites marker drafts between below and above snapshots", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(0, 0),
      scale: 1,
    });
    hotLayer.setDraftComposite({
      below: solidCanvas(200, 200, "#ff0000"),
      active: solidCanvas(200, 200, "#00ff00"),
      above: null,
    });

    hotLayer.renderDrafts([draftRect("draft-composite", [0, 0], "#0000ff")]);

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(ctx, 100, 100)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(ctx, 10, 10)).toEqual([0, 255, 0, 255]);
  });

  test("eraser drafts cut only the active snapshot and reveal below", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(0, 0),
      scale: 1,
    });
    hotLayer.setDraftComposite({
      below: solidCanvas(200, 200, "#ff0000"),
      active: solidCanvas(200, 200, "#00ff00"),
      above: null,
    });

    hotLayer.renderDrafts([
      draftPen(
        "eraser",
        [
          [-60, 0],
          [60, 0],
        ],
        "destination-out",
      ),
    ]);

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(ctx, 100, 100)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(ctx, 100, 60)).toEqual([0, 255, 0, 255]);
  });

  test("eraser drafts do not cut above snapshots", () => {
    const canvas = createCanvas(200, 200);
    const hotLayer = new HotLayer(canvas as unknown as HTMLCanvasElement, {
      shapeRendererRegistry,
    });
    hotLayer.setViewport({
      width: 200,
      height: 200,
      center: new Vec2(0, 0),
      scale: 1,
    });
    hotLayer.setDraftComposite({
      below: solidCanvas(200, 200, "#ff0000"),
      active: solidCanvas(200, 200, "#00ff00"),
      above: solidCanvas(200, 200, "#0000ff"),
    });

    hotLayer.renderDrafts([
      draftPen(
        "eraser",
        [
          [-60, 0],
          [60, 0],
        ],
        "destination-out",
      ),
    ]);

    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(ctx, 100, 100)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(ctx, 100, 60)).toEqual([0, 0, 255, 255]);
  });
});
