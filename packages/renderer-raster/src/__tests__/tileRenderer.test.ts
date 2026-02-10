import { describe, expect, test } from "bun:test";
import {
  type AnyShape,
  DrawingStore,
  type RectGeometry,
} from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import { renderOrderedShapes } from "@smalldraw/renderer-canvas";
import { createCanvas } from "canvas";
import {
  createInMemorySnapshotStore,
  getVisibleTileCoords,
  TILE_SIZE,
  TileRenderer,
  tileKey,
} from "../index";

describe("TileRenderer", () => {
  test("tracks viewport updates", () => {
    const store = new DrawingStore({ tools: [] });
    const provider = {
      getTileCanvas: () => ({}) as HTMLCanvasElement,
    };
    const renderer = new TileRenderer(store, provider);
    const bounds: Box = {
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    };
    renderer.updateViewport(bounds);
    expect(renderer.getViewport()).toEqual(bounds);
  });

  test("exposes render state", () => {
    const store = new DrawingStore({ tools: [] });
    const provider = {
      getTileCanvas: () => ({}) as HTMLCanvasElement,
    };
    const renderer = new TileRenderer(store, provider);
    const state = renderer.getRenderState();
    expect(Array.isArray(state.shapes)).toBeTrue();
    expect(state.dirtyState).toBeDefined();
  });

  test("computes visible tiles across boundaries", () => {
    const tiles = getVisibleTileCoords({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });
    expect(tiles).toEqual([{ x: 0, y: 0 }]);

    const panned = getVisibleTileCoords({
      min: [TILE_SIZE / 2, 0],
      max: [TILE_SIZE + TILE_SIZE / 2, TILE_SIZE],
    });
    expect(panned).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  test("creates and releases tiles deterministically", () => {
    const store = new DrawingStore({ tools: [] });
    const events: string[] = [];
    const provider = {
      getTileCanvas: (coord: { x: number; y: number }) => {
        events.push(`create:${coord.x},${coord.y}`);
        return { coord };
      },
      releaseTileCanvas: (coord: { x: number; y: number }) => {
        events.push(`release:${coord.x},${coord.y}`);
      },
    };
    const renderer = new TileRenderer(store, provider);

    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });
    renderer.updateViewport({
      min: [TILE_SIZE, 0],
      max: [TILE_SIZE * 2, TILE_SIZE],
    });

    expect(events).toEqual(["create:0,0", "create:1,0", "release:0,0"]);
  });

  test("tracks touched tiles and schedules bake after commit", async () => {
    const store = new DrawingStore({ tools: [] });
    const events: string[] = [];
    const provider = {
      getTileCanvas: (coord: { x: number; y: number }) => ({ coord }),
    };
    const baker = {
      bakeTile: async (coord: { x: number; y: number }) => {
        events.push(`bake:${coord.x},${coord.y}`);
      },
    };
    const renderer = new TileRenderer(store, provider, { baker });

    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE * 2, TILE_SIZE],
    });

    renderer.markShapeTouched("shape-1", { x: 0, y: 0 });
    renderer.markShapeTouched("shape-1", { x: 1, y: 0 });
    renderer.markShapeTouched("shape-1", { x: 1, y: 0 });
    renderer.scheduleBakeForShape("shape-1");

    expect(renderer.getPendingBakeTiles().map(tileKey)).toEqual(["0,0", "1,0"]);

    await renderer.bakePendingTiles();
    expect(events).toEqual(["bake:0,0", "bake:1,0"]);

    renderer.markShapeTouched("shape-1", { x: 0, y: 0 });
    renderer.scheduleBakeForShape("shape-1");
    expect(renderer.getPendingBakeTiles().map(tileKey)).toEqual(["0,0"]);
  });

  test("captures tiles when shape moves between tiles", () => {
    const store = new DrawingStore({ tools: [] });
    const provider = {
      getTileCanvas: (coord: { x: number; y: number }) => ({ coord }),
    };
    const renderer = new TileRenderer(store, provider);

    renderer.updateTouchedTilesForShape({
      id: "shape-1",
      type: "rect",
      zIndex: "a",
      geometry: { type: "rect", size: [50, 50] } as RectGeometry,
      transform: { translation: [TILE_SIZE / 2, TILE_SIZE / 2] },
      style: { fill: { type: "solid", color: "#000" } },
    });
    renderer.updateTouchedTilesForShape({
      id: "shape-1",
      type: "rect",
      zIndex: "a",
      geometry: { type: "rect", size: [50, 50] } as RectGeometry,
      transform: { translation: [TILE_SIZE / 2, TILE_SIZE / 2] },
      style: { fill: { type: "solid", color: "#000" } },
    });
    renderer.updateTouchedTilesForShape({
      id: "shape-1",
      type: "rect",
      zIndex: "a",
      geometry: { type: "rect", size: [50, 50] } as RectGeometry,
      transform: { translation: [TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2] },
      style: { fill: { type: "solid", color: "#000" } },
    });
    renderer.scheduleBakeForShape("shape-1");
    expect(renderer.getPendingBakeTiles().map(tileKey)).toEqual(["0,0", "1,0"]);
  });

  test("reuses cached snapshots until invalidated", async () => {
    const store = new DrawingStore({ tools: [] });
    const applyEvents: string[] = [];
    const captureEvents: string[] = [];
    const provider = {
      getTileCanvas: (coord: { x: number; y: number }) => ({ coord }),
    };
    const snapshotStore = createInMemorySnapshotStore<string>();
    const renderer = new TileRenderer(store, provider, {
      snapshotStore,
      snapshotAdapter: {
        captureSnapshot: (canvas) => {
          captureEvents.push(`capture:${canvas.coord.x},${canvas.coord.y}`);
          return `snap:${canvas.coord.x},${canvas.coord.y}`;
        },
        applySnapshot: (canvas, snapshot) => {
          applyEvents.push(
            `apply:${canvas.coord.x},${canvas.coord.y}:${snapshot}`,
          );
        },
      },
      baker: {
        bakeTile: async () => {},
      },
    });

    snapshotStore.setSnapshot("0,0", "snap:0,0");
    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });
    expect(applyEvents).toEqual(["apply:0,0:snap:0,0"]);

    renderer.markShapeTouched("shape-1", { x: 0, y: 0 });
    renderer.scheduleBakeForShape("shape-1");
    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });
    expect(applyEvents).toEqual(["apply:0,0:snap:0,0"]);

    await renderer.bakePendingTiles();
    expect(captureEvents).toEqual(["capture:0,0"]);
    renderer.updateViewport({
      min: [TILE_SIZE * 2, 0],
      max: [TILE_SIZE * 3, TILE_SIZE],
    });
    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });
    expect(applyEvents).toEqual(["apply:0,0:snap:0,0", "apply:0,0:snap:0,0"]);
  });

  test("scheduleBakeForShapes invalidates cached snapshots", () => {
    const store = new DrawingStore({ tools: [] });
    const deletions: string[] = [];
    const snapshotStore = {
      getSnapshot: () => undefined,
      setSnapshot: () => {},
      deleteSnapshot: (key: string) => {
        deletions.push(key);
      },
    };
    const provider = {
      getTileCanvas: () => ({}) as HTMLCanvasElement,
    };
    const renderer = new TileRenderer(store, provider, { snapshotStore });

    renderer.markShapeTouched("shape-1", { x: 0, y: 0 });
    renderer.markShapeTouched("shape-2", { x: 1, y: 0 });
    renderer.scheduleBakeForShapes(["shape-1", "shape-2"]);

    expect(deletions.sort()).toEqual(["0,0", "1,0"]);
  });

  test("bakes only visible tiles", async () => {
    const store = new DrawingStore({ tools: [] });
    const baked: string[] = [];
    const provider = {
      getTileCanvas: (coord: { x: number; y: number }) => ({ coord }),
    };
    const renderer = new TileRenderer(store, provider, {
      baker: {
        bakeTile: async (coord) => {
          baked.push(`${coord.x},${coord.y}`);
        },
      },
    });

    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });
    renderer.markShapeTouched("shape-1", { x: 0, y: 0 });
    renderer.markShapeTouched("shape-1", { x: 1, y: 0 });
    renderer.scheduleBakeForShape("shape-1");

    await renderer.bakePendingTiles();
    expect(baked).toEqual(["0,0"]);
    expect(renderer.getPendingBakeTiles()).toEqual([]);
  });

  test("skips applying snapshot when tile is pending bake", () => {
    const store = new DrawingStore({ tools: [] });
    const applyEvents: string[] = [];
    const snapshotStore = createInMemorySnapshotStore<string>();
    const provider = {
      getTileCanvas: (coord: { x: number; y: number }) => ({ coord }),
    };
    const renderer = new TileRenderer(store, provider, {
      snapshotStore,
      snapshotAdapter: {
        captureSnapshot: () => "snap",
        applySnapshot: (canvas, snapshot) => {
          applyEvents.push(
            `apply:${canvas.coord.x},${canvas.coord.y}:${snapshot}`,
          );
        },
      },
    });

    snapshotStore.setSnapshot("0,0", "snap:0,0");
    renderer.markShapeTouched("shape-1", { x: 0, y: 0 });
    renderer.scheduleBakeForShape("shape-1");
    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });

    expect(applyEvents).toEqual([]);
  });

  test("scheduleBakeForClear invalidates all visible tiles", async () => {
    const store = new DrawingStore({ tools: [] });
    const baked: string[] = [];
    const snapshotStore = createInMemorySnapshotStore<string>();
    snapshotStore.setSnapshot("0,0", "snap-a");
    snapshotStore.setSnapshot("1,0", "snap-b");
    const provider = {
      getTileCanvas: (coord: { x: number; y: number }) => ({ coord }),
    };
    const renderer = new TileRenderer(store, provider, {
      snapshotStore,
      baker: {
        bakeTile: async (coord) => {
          baked.push(`${coord.x},${coord.y}`);
        },
      },
    });

    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE * 2, TILE_SIZE],
    });
    renderer.scheduleBakeForClear();
    await renderer.bakePendingTiles();

    expect(baked.sort()).toEqual(["0,0", "1,0"]);
    expect(snapshotStore.getSnapshot("0,0")).toBeUndefined();
    expect(snapshotStore.getSnapshot("1,0")).toBeUndefined();
  });

  test("captureViewportSnapshot is resolution independent for hi-DPI tile canvases", async () => {
    const store = new DrawingStore({ tools: [] });
    const backingScale = 2;
    const provider = {
      getTileCanvas: () =>
        createCanvas(
          TILE_SIZE * backingScale,
          TILE_SIZE * backingScale,
        ) as unknown as HTMLCanvasElement,
    };
    const renderer = new TileRenderer(store, provider, {
      createViewportSnapshotCanvas: (width, height) =>
        createCanvas(width, height) as unknown as HTMLCanvasElement,
      baker: {
        bakeTile: (coord, canvas) => {
          const ctx = (
            canvas as unknown as ReturnType<typeof createCanvas>
          ).getContext("2d");
          const tileScaleX = canvas.width / TILE_SIZE;
          const tileScaleY = canvas.height / TILE_SIZE;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(tileScaleX, 0, 0, tileScaleY, 0, 0);
          ctx.translate(-coord.x * TILE_SIZE, -coord.y * TILE_SIZE);
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = "#ff0000";
          ctx.fillRect(TILE_SIZE / 2, 0, TILE_SIZE / 2, TILE_SIZE);
        },
      },
    });

    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE, TILE_SIZE],
    });
    renderer.scheduleBakeForClear();
    const snapshot = await renderer.captureViewportSnapshot();
    expect(snapshot).not.toBeNull();

    const snapshotCanvas = snapshot as unknown as ReturnType<
      typeof createCanvas
    >;
    const ctx = snapshotCanvas.getContext("2d");
    const leftPixel = ctx.getImageData(TILE_SIZE / 4, TILE_SIZE / 2, 1, 1).data;
    const rightPixel = ctx.getImageData(
      (TILE_SIZE * 3) / 4,
      TILE_SIZE / 2,
      1,
      1,
    ).data;

    expect(leftPixel[0]).toBe(0);
    expect(leftPixel[1]).toBe(0);
    expect(leftPixel[2]).toBe(0);
    expect(rightPixel[0]).toBe(255);
    expect(rightPixel[1]).toBe(0);
    expect(rightPixel[2]).toBe(0);
  });

  test("stitching matches across 1x and 2x backing stores for rect + pen + eraser", async () => {
    const worldWidth = TILE_SIZE;
    const worldHeight = TILE_SIZE;
    const samples: Array<[number, number]> = [
      [32, 32],
      [96, 96],
      [160, 96],
      [96, 160],
      [196, 196],
    ];
    const scene = [
      {
        id: "rect-1",
        type: "rect",
        zIndex: "a",
        geometry: { type: "rect", size: [220, 220] as [number, number] },
        transform: { translation: [128, 128] as [number, number] },
        style: { fill: { type: "solid", color: "#0ea5e9" as const } },
      },
      {
        id: "pen-1",
        type: "pen",
        zIndex: "b",
        geometry: {
          type: "pen",
          points: [
            [-80, -20],
            [-20, 10],
            [20, -10],
            [80, 20],
          ] as [number, number][],
        },
        transform: { translation: [128, 128] as [number, number] },
        style: {
          stroke: {
            type: "brush",
            color: "#111827",
            size: 28,
            brushId: "freehand",
          },
        },
      },
      {
        id: "eraser-1",
        type: "pen",
        zIndex: "c",
        geometry: {
          type: "pen",
          points: [
            [-70, 0],
            [0, 0],
            [70, 0],
          ] as [number, number][],
        },
        transform: { translation: [128, 128] as [number, number] },
        style: {
          stroke: {
            type: "brush",
            color: "#ffffff",
            size: 22,
            brushId: "marker",
            compositeOp: "destination-out",
          },
        },
      },
    ] as unknown as AnyShape[];

    const captureAtScale = async (backingScale: number) => {
      const store = new DrawingStore({ tools: [] });
      const provider = {
        getTileCanvas: () =>
          createCanvas(
            TILE_SIZE * backingScale,
            TILE_SIZE * backingScale,
          ) as unknown as HTMLCanvasElement,
      };
      const renderer = new TileRenderer(store, provider, {
        backgroundColor: "#ffffff",
        createViewportSnapshotCanvas: (width, height) =>
          createCanvas(width, height) as unknown as HTMLCanvasElement,
        baker: {
          bakeTile: (coord, canvas) => {
            const ctx = (
              canvas as unknown as ReturnType<typeof createCanvas>
            ).getContext("2d");
            const tileScaleX = canvas.width / TILE_SIZE;
            const tileScaleY = canvas.height / TILE_SIZE;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.setTransform(tileScaleX, 0, 0, tileScaleY, 0, 0);
            ctx.translate(-coord.x * TILE_SIZE, -coord.y * TILE_SIZE);
            renderOrderedShapes(
              ctx as unknown as CanvasRenderingContext2D,
              scene,
            );
            ctx.restore();
          },
        },
      });
      renderer.updateViewport({
        min: [0, 0],
        max: [worldWidth, worldHeight],
      });
      renderer.scheduleBakeForClear();
      const snapshot = await renderer.captureViewportSnapshot();
      expect(snapshot).not.toBeNull();
      return snapshot as unknown as ReturnType<typeof createCanvas>;
    };

    const oneX = await captureAtScale(1);
    const twoX = await captureAtScale(2);
    const oneCtx = oneX.getContext("2d");
    const twoCtx = twoX.getContext("2d");

    for (const [x, y] of samples) {
      const onePixel = oneCtx.getImageData(x, y, 1, 1).data;
      const twoPixel = twoCtx.getImageData(x, y, 1, 1).data;
      expect(Array.from(twoPixel)).toEqual(Array.from(onePixel));
    }
  });

  test("1x snapshot matches downscaled 2x snapshot for same operations", async () => {
    const worldWidth = TILE_SIZE;
    const worldHeight = TILE_SIZE;
    const scene = [
      {
        id: "rect-bg",
        type: "rect",
        zIndex: "a",
        geometry: { type: "rect", size: [220, 220] as [number, number] },
        transform: { translation: [128, 128] as [number, number] },
        style: { fill: { type: "solid", color: "#fde047" } },
      },
      {
        id: "pen-accent",
        type: "pen",
        zIndex: "b",
        geometry: {
          type: "pen",
          points: [
            [-80, -40],
            [-20, 20],
            [20, -10],
            [90, 40],
          ] as [number, number][],
        },
        transform: { translation: [128, 128] as [number, number] },
        style: {
          stroke: {
            type: "brush",
            color: "#1f2937",
            size: 20,
            brushId: "freehand",
          },
        },
      },
      {
        id: "eraser-cut",
        type: "pen",
        zIndex: "c",
        geometry: {
          type: "pen",
          points: [
            [-60, 0],
            [0, 0],
            [60, 0],
          ] as [number, number][],
        },
        transform: { translation: [128, 128] as [number, number] },
        style: {
          stroke: {
            type: "brush",
            color: "#ffffff",
            size: 16,
            brushId: "marker",
            compositeOp: "destination-out",
          },
        },
      },
    ] as unknown as AnyShape[];

    const captureSnapshot = async (backingScale: number) => {
      const store = new DrawingStore({ tools: [] });
      const provider = {
        getTileCanvas: () =>
          createCanvas(
            TILE_SIZE * backingScale,
            TILE_SIZE * backingScale,
          ) as unknown as HTMLCanvasElement,
      };
      const renderer = new TileRenderer(store, provider, {
        backgroundColor: "#ffffff",
        createViewportSnapshotCanvas: (w, h) =>
          createCanvas(w, h) as unknown as HTMLCanvasElement,
        baker: {
          bakeTile: (coord, canvas) => {
            const ctx = (
              canvas as unknown as ReturnType<typeof createCanvas>
            ).getContext("2d");
            const tileScaleX = canvas.width / TILE_SIZE;
            const tileScaleY = canvas.height / TILE_SIZE;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.setTransform(tileScaleX, 0, 0, tileScaleY, 0, 0);
            ctx.translate(-coord.x * TILE_SIZE, -coord.y * TILE_SIZE);
            renderOrderedShapes(
              ctx as unknown as CanvasRenderingContext2D,
              scene,
            );
            ctx.restore();
          },
        },
      });
      renderer.updateViewport({
        min: [0, 0],
        max: [worldWidth, worldHeight],
      });
      renderer.scheduleBakeForClear();
      const snapshot = await renderer.captureViewportSnapshot();
      expect(snapshot).not.toBeNull();
      return snapshot as unknown as ReturnType<typeof createCanvas>;
    };

    const oneX = await captureSnapshot(1);
    const twoX = await captureSnapshot(2);
    const downscaledTwoX = createCanvas(worldWidth, worldHeight);
    const downscaledCtx = downscaledTwoX.getContext("2d");
    downscaledCtx.imageSmoothingEnabled = true;
    downscaledCtx.clearRect(0, 0, worldWidth, worldHeight);
    downscaledCtx.drawImage(twoX, 0, 0, worldWidth, worldHeight);

    const oneCtx = oneX.getContext("2d");
    const tolerance = 8;
    for (let y = 0; y < worldHeight; y += 8) {
      for (let x = 0; x < worldWidth; x += 8) {
        const onePixel = oneCtx.getImageData(x, y, 1, 1).data;
        const downscaledPixel = downscaledCtx.getImageData(x, y, 1, 1).data;
        for (let c = 0; c < 4; c += 1) {
          const delta = Math.abs(onePixel[c] - downscaledPixel[c]);
          expect(delta).toBeLessThanOrEqual(tolerance);
        }
      }
    }
  });
});
