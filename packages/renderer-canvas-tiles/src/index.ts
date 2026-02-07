import type {
  AnyShape,
  DirtyState,
  DrawingStore,
  Shape,
  ShapeHandlerRegistry,
} from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import {
  getOrderedShapesBounds,
  renderOrderedShapes,
} from "@smalldraw/renderer-canvas";
import { TILE_SIZE } from "./constants";
import type {
  TileBaker,
  TileCoord,
  TileProvider,
  TileSnapshotAdapter,
  TileSnapshotStore,
} from "./types";
import { createInMemorySnapshotStore } from "./snapshots";
import { getVisibleTileCoords, tileKey, tileKeyToCoord } from "./tiles";

export interface TileRendererOptions<
  TCanvas = HTMLCanvasElement,
  TSnapshot = unknown,
> {
  shapeHandlers?: ShapeHandlerRegistry;
  tileSize?: number;
  baker?: TileBaker<TCanvas>;
  snapshotAdapter?: TileSnapshotAdapter<TCanvas, TSnapshot>;
  snapshotStore?: TileSnapshotStore<TSnapshot>;
}

export interface TileRenderState {
  shapes: Shape[];
  dirtyState: DirtyState;
}

export interface TileRendererHandle {
  updateViewport: (bounds: Box) => void;
  dispose: () => void;
}

export function bind(
  coreStore: DrawingStore,
  tileProvider: TileProvider,
  options: TileRendererOptions = {},
): TileRendererHandle {
  const renderer = new TileRenderer(coreStore, tileProvider, options);
  return {
    updateViewport: (bounds) => renderer.updateViewport(bounds),
    dispose: () => renderer.dispose(),
  };
}

export class TileRenderer<
  TCanvas = HTMLCanvasElement,
  TSnapshot = unknown,
> {
  private coreStore: DrawingStore;
  private tileProvider: TileProvider<TCanvas>;
  private shapeHandlers: ShapeHandlerRegistry;
  private tileSize: number;
  private baker?: TileBaker<TCanvas>;
  private snapshotAdapter?: TileSnapshotAdapter<TCanvas, TSnapshot>;
  private snapshotStore: TileSnapshotStore<TSnapshot>;
  private viewport: Box | null = null;
  private unsubscribe?: () => void;
  private visibleTiles = new Map<string, { coord: TileCoord; canvas: TCanvas }>();
  private visibleOrder: TileCoord[] = [];
  private touchedTilesByShape = new Map<string, Set<string>>();
  private lastTilesByShape = new Map<string, Set<string>>();
  private pendingBakeTiles = new Set<string>();

  constructor(
    coreStore: DrawingStore,
    tileProvider: TileProvider<TCanvas>,
    options: TileRendererOptions<TCanvas, TSnapshot> = {},
  ) {
    this.coreStore = coreStore;
    this.tileProvider = tileProvider;
    this.shapeHandlers =
      options.shapeHandlers ?? this.coreStore.getShapeHandlers();
    this.tileSize = options.tileSize ?? TILE_SIZE;
    this.baker = options.baker;
    this.snapshotAdapter = options.snapshotAdapter;
    this.snapshotStore =
      options.snapshotStore ?? createInMemorySnapshotStore<TSnapshot>();
  }

  updateViewport(bounds: Box): void {
    this.viewport = bounds;
    const nextVisible = getVisibleTileCoords(bounds, this.tileSize);
    this.syncVisibleTiles(nextVisible);
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  getViewport(): Box | null {
    return this.viewport;
  }

  getVisibleTiles(): TileCoord[] {
    return [...this.visibleOrder];
  }

  getRenderState(): TileRenderState {
    return this.coreStore.getRenderState();
  }

  getShapeBounds(
    shapes: AnyShape[],
  ): ReturnType<typeof getOrderedShapesBounds> {
    return getOrderedShapesBounds(shapes, this.shapeHandlers);
  }

  renderShapes(ctx: CanvasRenderingContext2D, shapes: Shape[]): void {
    renderOrderedShapes(ctx, shapes, {
      geometryHandlerRegistry: this.shapeHandlers,
    });
  }

  updateTouchedTilesForShape(shape: AnyShape): void {
    const { bounds } = getOrderedShapesBounds([shape], this.shapeHandlers);
    if (!bounds) return;
    const tiles = getVisibleTileCoords(bounds, this.tileSize);
    const nextKeys = new Set(tiles.map(tileKey));
    const touched = this.touchedTilesByShape.get(shape.id) ?? new Set<string>();
    const previous = this.lastTilesByShape.get(shape.id);
    if (previous) {
      for (const key of previous) {
        touched.add(key);
      }
    }
    for (const key of nextKeys) {
      touched.add(key);
    }
    this.touchedTilesByShape.set(shape.id, touched);
    this.lastTilesByShape.set(shape.id, nextKeys);
  }

  markShapeTouched(shapeId: string, tile: TileCoord): void {
    const key = tileKey(tile);
    const existing = this.touchedTilesByShape.get(shapeId);
    if (existing) {
      existing.add(key);
      return;
    }
    this.touchedTilesByShape.set(shapeId, new Set([key]));
  }

  markShapeTouchedTiles(shapeId: string, tiles: TileCoord[]): void {
    if (!tiles.length) return;
    let existing = this.touchedTilesByShape.get(shapeId);
    if (!existing) {
      existing = new Set<string>();
      this.touchedTilesByShape.set(shapeId, existing);
    }
    for (const tile of tiles) {
      existing.add(tileKey(tile));
    }
  }

  scheduleBakeForShape(shapeId: string): void {
    const touched = this.touchedTilesByShape.get(shapeId);
    if (!touched) return;
    for (const key of touched) {
      this.pendingBakeTiles.add(key);
      this.snapshotStore.deleteSnapshot(key);
    }
    this.touchedTilesByShape.set(shapeId, new Set());
  }

  scheduleBakeForShapes(shapeIds: Iterable<string>): void {
    for (const shapeId of shapeIds) {
      this.scheduleBakeForShape(shapeId);
    }
  }

  getPendingBakeTiles(): TileCoord[] {
    const tiles: TileCoord[] = [];
    for (const key of this.pendingBakeTiles) {
      tiles.push(tileKeyToCoord(key));
    }
    return tiles;
  }

  async bakePendingTiles(): Promise<void> {
    if (!this.baker) return;
    for (const key of this.pendingBakeTiles) {
      const entry = this.visibleTiles.get(key);
      if (!entry) continue;
      await this.baker.bakeTile(entry.coord, entry.canvas);
      if (this.snapshotAdapter) {
        const snapshot = this.snapshotAdapter.captureSnapshot(entry.canvas);
        this.snapshotStore.setSnapshot(key, snapshot);
      }
    }
    this.pendingBakeTiles.clear();
  }

  private syncVisibleTiles(nextVisible: TileCoord[]): void {
    const nextKeys = new Set<string>();
    for (const coord of nextVisible) {
      const key = tileKey(coord);
      nextKeys.add(key);
      if (!this.visibleTiles.has(key)) {
        const canvas = this.tileProvider.getTileCanvas(coord);
        this.visibleTiles.set(key, { coord, canvas });
        const snapshot = this.snapshotStore.getSnapshot(key);
        if (snapshot && this.snapshotAdapter && !this.pendingBakeTiles.has(key)) {
          this.snapshotAdapter.applySnapshot(canvas, snapshot);
        }
      }
    }

    for (const [key, entry] of this.visibleTiles) {
      if (nextKeys.has(key)) continue;
      this.tileProvider.releaseTileCanvas?.(
        entry.coord,
        entry.canvas,
      );
      this.visibleTiles.delete(key);
    }

    this.visibleOrder = nextVisible;
  }
}

export type {
  TileBaker,
  TileCoord,
  TileProvider,
  TileSnapshotAdapter,
  TileSnapshotStore,
} from "./types";
export { createDomTileProvider, type DomTileProviderOptions } from "./dom";
export { TILE_SIZE } from "./constants";
export { getVisibleTileCoords, tileKey, tileKeyToCoord } from "./tiles";
export { createInMemorySnapshotStore } from "./snapshots";
