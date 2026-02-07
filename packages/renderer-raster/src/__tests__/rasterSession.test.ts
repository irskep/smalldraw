import { describe, expect, test } from "bun:test";
import { createCanvas } from "canvas";
import { DrawingStore, createEraserTool, createPenTool } from "@smalldraw/core";
import { Vec2 } from "gl-matrix";
import { HotLayer, RasterSession, TILE_SIZE, TileRenderer } from "../index";

function pixelAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): [number, number, number, number] {
  const data = ctx.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

describe("RasterSession", () => {
  test("runs draw cycle from draft to baked tiles", async () => {
    const store = new DrawingStore({
      tools: [createPenTool()],
    });
    const bakeCalls: string[] = [];
    const tileCanvases = new Map<string, ReturnType<typeof createCanvas>>();
    const provider = {
      getTileCanvas: (coord: { x: number; y: number }) => {
        const key = `${coord.x},${coord.y}`;
        const existing = tileCanvases.get(key);
        if (existing) return existing;
        const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
        tileCanvases.set(key, canvas);
        return canvas;
      },
    };

    const renderer = new TileRenderer(store, provider, {
      backgroundColor: "#ffffff",
      baker: {
        bakeTile: async (coord, canvas) => {
          bakeCalls.push(`${coord.x},${coord.y}`);
          const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(-coord.x * TILE_SIZE, -coord.y * TILE_SIZE);
          renderer.renderShapes(ctx, store.getOrderedShapes());
          ctx.restore();
        },
      },
    });
    const hotCanvas = createCanvas(TILE_SIZE, TILE_SIZE);
    const hotLayer = new HotLayer(hotCanvas as unknown as HTMLCanvasElement);
    const session = new RasterSession(store, renderer, hotLayer);

    hotLayer.setViewport({
      width: TILE_SIZE,
      height: TILE_SIZE,
      center: new Vec2(TILE_SIZE / 2, TILE_SIZE / 2),
      scale: 1,
    });
    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });
    store.setOnRenderNeeded(() => session.render());

    store.activateTool("pen");
    store.dispatch("pointerDown", {
      point: new Vec2(80, 80),
      buttons: 1,
    });
    store.dispatch("pointerMove", {
      point: new Vec2(140, 140),
      buttons: 1,
    });

    const hotCtx = hotCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(store.getDrafts().length).toBeGreaterThan(0);
    expect(pixelAt(hotCtx, 110, 110)[3]).toBeGreaterThan(0);

    store.dispatch("pointerUp", {
      point: new Vec2(140, 140),
      buttons: 0,
    });
    await session.flushBakes();

    expect(store.getDrafts()).toHaveLength(0);
    expect(pixelAt(hotCtx, 110, 110)[3]).toBe(0);
    expect(bakeCalls).toEqual(["0,0"]);
    expect(renderer.getPendingBakeTiles()).toEqual([]);

    const tileCanvas = tileCanvases.get("0,0");
    if (!tileCanvas) {
      throw new Error("Expected baked tile 0,0");
    }
    const tileCtx = tileCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(pixelAt(tileCtx, 110, 110)[3]).toBeGreaterThan(0);
  });

  test("uses snapshot backdrop while erasing and clears after commit", async () => {
    const store = new DrawingStore({
      tools: [createEraserTool()],
    });
    const provider = {
      getTileCanvas: () => createCanvas(TILE_SIZE, TILE_SIZE),
    };

    const renderer = new TileRenderer(store, provider, {
      backgroundColor: "#ffffff",
    });
    const hotCanvas = createCanvas(TILE_SIZE, TILE_SIZE);
    (hotCanvas as unknown as { style?: { backgroundColor: string } }).style = {
      backgroundColor: "",
    };
    const hotLayer = new HotLayer(hotCanvas as unknown as HTMLCanvasElement);
    hotLayer.setViewport({
      width: TILE_SIZE,
      height: TILE_SIZE,
      center: new Vec2(TILE_SIZE / 2, TILE_SIZE / 2),
      scale: 1,
    });

    let captureCalls = 0;
    renderer.captureViewportSnapshot = async () => {
      captureCalls += 1;
      const snapshot = createCanvas(TILE_SIZE, TILE_SIZE);
      const ctx = snapshot.getContext("2d") as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      return snapshot as unknown as CanvasImageSource;
    };
    const session = new RasterSession(store, renderer, hotLayer);

    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });
    store.setOnRenderNeeded(() => session.render());
    store.activateTool("eraser");

    store.dispatch("pointerDown", {
      point: new Vec2(80, 80),
      buttons: 1,
    });
    store.dispatch("pointerMove", {
      point: new Vec2(140, 140),
      buttons: 1,
    });
    store.dispatch("pointerMove", {
      point: new Vec2(150, 150),
      buttons: 1,
    });

    const hotCtx = hotCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    for (let i = 0; i < 10 && pixelAt(hotCtx, 10, 10)[3] === 0; i += 1) {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(captureCalls).toBe(1);
    expect(pixelAt(hotCtx, 10, 10)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(hotCtx, 110, 110)[3]).toBe(0);

    store.dispatch("pointerUp", {
      point: new Vec2(150, 150),
      buttons: 0,
    });

    expect(store.getDrafts()).toHaveLength(0);
    expect(pixelAt(hotCtx, 10, 10)[3]).toBe(0);
  });
});
