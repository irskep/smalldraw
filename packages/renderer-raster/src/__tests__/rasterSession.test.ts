import { describe, expect, test } from "bun:test";
import { createCanvas } from "canvas";
import {
  AddShape,
  type AnyShape,
  ClearCanvas,
  createDocument,
  DrawingStore,
  getDefaultShapeHandlerRegistry,
  type ToolDefinition,
  createEraserTool,
  createPenTool,
} from "@smalldraw/core";
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
          const ctx = canvas.getContext(
            "2d",
          ) as unknown as CanvasRenderingContext2D;
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

    const hotCtx = hotCanvas.getContext(
      "2d",
    ) as unknown as CanvasRenderingContext2D;
    expect(store.getDrafts().length).toBeGreaterThan(0);
    for (let i = 0; i < 10 && pixelAt(hotCtx, 110, 110)[3] === 0; i += 1) {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(pixelAt(hotCtx, 110, 110)[3]).toBeGreaterThan(0);

    store.dispatch("pointerUp", {
      point: new Vec2(140, 140),
      buttons: 0,
    });
    await session.flushBakes();

    expect(store.getDrafts()).toHaveLength(0);
    expect(pixelAt(hotCtx, 110, 110)[3]).toBeLessThanOrEqual(16);
    expect(bakeCalls).toEqual(["0,0"]);
    expect(renderer.getPendingBakeTiles()).toEqual([]);

    const tileCanvas = tileCanvases.get("0,0");
    if (!tileCanvas) {
      throw new Error("Expected baked tile 0,0");
    }
    const tileCtx = tileCanvas.getContext(
      "2d",
    ) as unknown as CanvasRenderingContext2D;
    expect(pixelAt(tileCtx, 110, 110)[3]).toBeGreaterThan(0);
  });

  test("pen keeps backdrop visible while drawing on hot layer", async () => {
    const store = new DrawingStore({
      tools: [createPenTool()],
    });
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
      baker: {
        bakeTile: async (coord, canvas) => {
          const ctx = canvas.getContext(
            "2d",
          ) as unknown as CanvasRenderingContext2D;
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
    const layerModes: Array<"tiles" | "hot"> = [];
    let captureCalls = 0;
    renderer.captureViewportSnapshot = async () => {
      captureCalls += 1;
      const snapshot = createCanvas(TILE_SIZE, TILE_SIZE);
      const ctx = snapshot.getContext(
        "2d",
      ) as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = "#0000ff";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      return snapshot as unknown as CanvasImageSource;
    };
    const session = new RasterSession(store, renderer, hotLayer, {
      layerController: {
        setMode: (mode) => {
          layerModes.push(mode);
        },
      },
    });
    store.setOnRenderNeeded(() => session.render());

    store.activateTool("pen");
    store.dispatch("pointerDown", {
      point: new Vec2(120, 120),
      buttons: 1,
    });
    store.dispatch("pointerMove", {
      point: new Vec2(150, 150),
      buttons: 1,
    });

    const hotCtx = hotCanvas.getContext(
      "2d",
    ) as unknown as CanvasRenderingContext2D;
    for (let i = 0; i < 10 && pixelAt(hotCtx, 40, 40)[3] === 0; i += 1) {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(captureCalls).toBe(1);
    expect(layerModes).toContain("hot");
    expect(pixelAt(hotCtx, 40, 40)).toEqual([0, 0, 255, 255]);
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
      const ctx = snapshot.getContext(
        "2d",
      ) as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      return snapshot as unknown as CanvasImageSource;
    };
    const layerModes: Array<"tiles" | "hot"> = [];
    const session = new RasterSession(store, renderer, hotLayer, {
      layerController: {
        setMode: (mode) => {
          layerModes.push(mode);
        },
      },
    });

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

    const hotCtx = hotCanvas.getContext(
      "2d",
    ) as unknown as CanvasRenderingContext2D;
    for (let i = 0; i < 10 && pixelAt(hotCtx, 10, 10)[3] === 0; i += 1) {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(captureCalls).toBe(1);
    expect(layerModes).toContain("hot");
    expect(pixelAt(hotCtx, 10, 10)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(hotCtx, 110, 110)[3]).toBeLessThanOrEqual(16);

    store.dispatch("pointerUp", {
      point: new Vec2(150, 150),
      buttons: 0,
    });

    expect(store.getDrafts()).toHaveLength(0);
    expect(layerModes[layerModes.length - 1]).toBe("tiles");
    expect(pixelAt(hotCtx, 10, 10)[3]).toBe(0);
  });

  test("clear canvas triggers full visible tile rebake", async () => {
    const store = new DrawingStore({ tools: [] });
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
      baker: {
        bakeTile: async (coord) => {
          bakeCalls.push(`${coord.x},${coord.y}`);
        },
      },
    });
    const hotCanvas = createCanvas(TILE_SIZE * 2, TILE_SIZE * 2);
    const hotLayer = new HotLayer(hotCanvas as unknown as HTMLCanvasElement);
    hotLayer.setViewport({
      width: TILE_SIZE * 2,
      height: TILE_SIZE * 2,
      center: new Vec2(TILE_SIZE, TILE_SIZE),
      scale: 1,
    });
    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE * 2, TILE_SIZE * 2],
    });

    const session = new RasterSession(store, renderer, hotLayer);
    store.setOnRenderNeeded(() => session.render());

    store.applyAction(
      new ClearCanvas({
        id: "clear-1",
        type: "clear",
        zIndex: "a",
        geometry: { type: "clear" },
        style: {},
      }),
    );
    await session.flushBakes();

    expect(new Set(bakeCalls)).toEqual(new Set(["0,0", "1,0", "0,1", "1,1"]));
  });

  test("undoing first committed shape rebakes tiles back to empty", async () => {
    const store = new DrawingStore({ tools: [] });
    const tileCanvas = createCanvas(TILE_SIZE, TILE_SIZE);
    const provider = {
      getTileCanvas: () => tileCanvas,
    };
    const renderer = new TileRenderer(store, provider, {
      backgroundColor: "#ffffff",
      baker: {
        bakeTile: async (coord, canvas) => {
          const ctx = canvas.getContext(
            "2d",
          ) as unknown as CanvasRenderingContext2D;
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
    const session = new RasterSession(store, renderer, hotLayer);
    store.setOnRenderNeeded(() => session.render());

    store.applyAction(
      new AddShape({
        id: "rect-1",
        type: "rect",
        zIndex: "a",
        geometry: { type: "rect", size: [80, 80] },
        transform: { translation: [64, 64] },
        style: { fill: { type: "solid", color: "#ff0000" } },
      } as AnyShape),
    );
    await session.flushBakes();

    const tileCtx = tileCanvas.getContext(
      "2d",
    ) as unknown as CanvasRenderingContext2D;
    expect(pixelAt(tileCtx, 64, 64)).toEqual([255, 0, 0, 255]);

    store.undo();
    await session.flushBakes();

    expect(Object.values(store.getDocument().shapes)).toHaveLength(0);
    expect(pixelAt(tileCtx, 64, 64)).not.toEqual([255, 0, 0, 255]);
  });

  test("rebakes to clear when renderable document becomes empty even with no dirty IDs", async () => {
    const store = new DrawingStore({ tools: [] });
    const tileCanvas = createCanvas(TILE_SIZE, TILE_SIZE);
    const provider = {
      getTileCanvas: () => tileCanvas,
    };
    const renderer = new TileRenderer(store, provider, {
      backgroundColor: "#ffffff",
      baker: {
        bakeTile: async (coord, canvas) => {
          const ctx = canvas.getContext(
            "2d",
          ) as unknown as CanvasRenderingContext2D;
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
    const session = new RasterSession(store, renderer, hotLayer);
    store.setOnRenderNeeded(() => session.render());

    store.applyAction(
      new AddShape({
        id: "rect-1",
        type: "rect",
        zIndex: "a",
        geometry: { type: "rect", size: [80, 80] },
        transform: { translation: [64, 64] },
        style: { fill: { type: "solid", color: "#ff0000" } },
      } as AnyShape),
    );
    await session.flushBakes();

    const tileCtx = tileCanvas.getContext(
      "2d",
    ) as unknown as CanvasRenderingContext2D;
    expect(pixelAt(tileCtx, 64, 64)).toEqual([255, 0, 0, 255]);

    // Simulate adapter-timing edge case where state transitions to empty
    // but dirty/deleted IDs are consumed before the next render.
    const emptyDoc = createDocument(
      undefined,
      getDefaultShapeHandlerRegistry(),
    );
    store.applyDocument(emptyDoc);
    store.consumeDirtyState();
    session.render();
    await session.flushBakes();

    expect(Object.values(store.getDocument().shapes)).toHaveLength(0);
    expect(pixelAt(tileCtx, 64, 64)).not.toEqual([255, 0, 0, 255]);
  });

  test("passes tool preview dirty bounds into hot-layer render", () => {
    const previewTool: ToolDefinition = {
      id: "preview",
      label: "Preview",
      activate(runtime) {
        runtime.on("pointerDown", () => {
          runtime.setPreview({
            dirtyBounds: { min: [10, 10], max: [40, 40] },
          });
        });
        return () => runtime.setPreview(null);
      },
    };
    const store = new DrawingStore({
      tools: [previewTool],
    });
    const renderer = new TileRenderer(store, {
      getTileCanvas: () => createCanvas(TILE_SIZE, TILE_SIZE),
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

    const dirtyBoundsCalls: Array<unknown> = [];
    const originalRenderDrafts = hotLayer.renderDrafts.bind(hotLayer);
    (
      hotLayer as unknown as { renderDrafts: typeof hotLayer.renderDrafts }
    ).renderDrafts = (drafts, options) => {
      dirtyBoundsCalls.push(options?.dirtyBounds ?? null);
      return originalRenderDrafts(drafts, options);
    };

    store.setOnRenderNeeded(() => session.render());
    store.activateTool("preview");
    store.dispatch("pointerDown", {
      point: new Vec2(10, 10),
      buttons: 1,
    });
    store.dispatch("pointerMove", {
      point: new Vec2(40, 40),
      buttons: 1,
    });

    const lastDirtyBounds = dirtyBoundsCalls[dirtyBoundsCalls.length - 1] as {
      min: [number, number];
      max: [number, number];
    } | null;
    expect(lastDirtyBounds).not.toBeNull();
    expect(lastDirtyBounds!.max[0]).toBeGreaterThan(lastDirtyBounds!.min[0]);
    expect(lastDirtyBounds!.max[1]).toBeGreaterThan(lastDirtyBounds!.min[1]);
  });
});
