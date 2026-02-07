import { describe, expect, test } from "bun:test";
import { DrawingStore, type RectGeometry } from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import {
  TILE_SIZE,
  TileRenderer,
  createInMemorySnapshotStore,
  getVisibleTileCoords,
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

    expect(events).toEqual([
      "create:0,0",
      "create:1,0",
      "release:0,0",
    ]);
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

    expect(renderer.getPendingBakeTiles().map(tileKey)).toEqual([
      "0,0",
      "1,0",
    ]);

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
    expect(renderer.getPendingBakeTiles().map(tileKey)).toEqual([
      "0,0",
      "1,0",
    ]);
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
    expect(applyEvents).toEqual([
      "apply:0,0:snap:0,0",
      "apply:0,0:snap:0,0",
    ]);
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
});
