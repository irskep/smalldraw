import { describe, expect, test } from "bun:test";
import type { BoxedGeometry } from "@smalldraw/core";
import { DrawingStore } from "@smalldraw/core";
import { TILE_SIZE } from "../constants";
import { TileRenderer } from "../index";
import { createInMemorySnapshotStore } from "../snapshots";
import { tileKey } from "../tiles";
import { createTestShapeRendererRegistry } from "./testShapeRendererRegistry";

const shapeRendererRegistry = createTestShapeRendererRegistry();

function createBoxedShape(id: string, tileX: number) {
  return {
    id,
    type: "boxed" as const,
    zIndex: "a0",
    geometry: {
      type: "boxed" as const,
      kind: "rect",
      size: [100, 100],
    } as BoxedGeometry,
    transform: {
      translation: [tileX * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2] as [
        number,
        number,
      ],
    },
    style: { fill: { type: "solid" as const, color: "#000000" } },
  };
}

function createTileBounds(tileX: number) {
  return {
    min: [tileX * TILE_SIZE, 0] as [number, number],
    max: [(tileX + 1) * TILE_SIZE, TILE_SIZE] as [number, number],
  };
}

function createRenderer() {
  const store = new DrawingStore({ tools: [] });
  const provider = {
    getTileCanvas: (coord: { x: number; y: number }) => ({ coord }),
  };
  const renderer = new TileRenderer(store, provider, {
    shapeRendererRegistry,
    baker: {
      bakeTile: async () => {},
    },
  });
  renderer.updateViewport({
    min: [0, 0],
    max: [TILE_SIZE * 4, TILE_SIZE],
  });
  return renderer;
}

describe("TileRenderer region dirtying", () => {
  test("markShapeRegionDirty schedules tiles for both previous and next bounds", () => {
    const renderer = createRenderer();

    renderer.markShapeRegionDirty(
      "shape-1",
      createTileBounds(0),
      createTileBounds(1),
    );

    expect(renderer.getPendingBakeTiles().map(tileKey).sort()).toEqual([
      "0,0",
      "1,0",
    ]);
  });

  test("markShapeRegionDirty updates shape tile memory to the next bounds", async () => {
    const renderer = createRenderer();

    renderer.markShapeRegionDirty(
      "shape-1",
      createTileBounds(0),
      createTileBounds(1),
    );
    await renderer.bakePendingTiles();

    renderer.updateTouchedTilesForShape(createBoxedShape("shape-1", 1));
    renderer.scheduleBakeForShape("shape-1");

    expect(renderer.getPendingBakeTiles().map(tileKey)).toEqual(["1,0"]);
  });

  test("markShapeRegionDirty with null next bounds clears shape tile memory", async () => {
    const renderer = createRenderer();

    renderer.markShapeRegionDirty("shape-1", createTileBounds(0), null);
    await renderer.bakePendingTiles();

    renderer.scheduleBakeForShape("shape-1");

    expect(renderer.getPendingBakeTiles()).toEqual([]);
  });

  test("markShapeRegionDirty invalidates cached snapshots for affected tiles", () => {
    const store = new DrawingStore({ tools: [] });
    const snapshotStore = createInMemorySnapshotStore<string>();
    snapshotStore.setSnapshot("0,0", "snap-0");
    snapshotStore.setSnapshot("1,0", "snap-1");
    const provider = {
      getTileCanvas: (coord: { x: number; y: number }) => ({ coord }),
    };
    const renderer = new TileRenderer(store, provider, {
      shapeRendererRegistry,
      snapshotStore,
      baker: {
        bakeTile: async () => {},
      },
    });
    renderer.updateViewport({
      min: [0, 0],
      max: [TILE_SIZE * 3, TILE_SIZE],
    });

    renderer.markShapeRegionDirty(
      "shape-1",
      createTileBounds(0),
      createTileBounds(1),
    );

    expect(snapshotStore.getSnapshot("0,0")).toBeUndefined();
    expect(snapshotStore.getSnapshot("1,0")).toBeUndefined();
  });

  test("remote move followed by local move cleans up the remote position", async () => {
    const renderer = createRenderer();

    renderer.markShapeRegionDirty(
      "shape-1",
      createTileBounds(0),
      createTileBounds(1),
    );
    await renderer.bakePendingTiles();

    renderer.updateTouchedTilesForShape(createBoxedShape("shape-1", 2));
    renderer.scheduleBakeForShape("shape-1");

    expect(renderer.getPendingBakeTiles().map(tileKey).sort()).toEqual([
      "1,0",
      "2,0",
    ]);
  });
});
