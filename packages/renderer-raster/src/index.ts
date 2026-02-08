import type {
  AnyShape,
  DirtyState,
  DrawingStore,
  Shape,
  ShapeHandlerRegistry,
} from "@smalldraw/core";
import { getX, getY, type Box } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
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
import {
  perfAddCounter,
  perfAddTimingMs,
  perfFlagEnabled,
  perfNowMs,
} from "./perfDebug";

export interface TileRendererOptions<
  TCanvas = HTMLCanvasElement,
  TSnapshot = unknown,
> {
  shapeHandlers?: ShapeHandlerRegistry;
  tileSize?: number;
  backgroundColor?: string;
  baker?: TileBaker<TCanvas>;
  snapshotAdapter?: TileSnapshotAdapter<TCanvas, TSnapshot>;
  snapshotStore?: TileSnapshotStore<TSnapshot>;
  createViewportSnapshotCanvas?: (
    width: number,
    height: number,
  ) => HTMLCanvasElement;
  renderIdentity?: string;
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
  private backgroundColor?: string;
  private createViewportSnapshotCanvas?: (
    width: number,
    height: number,
  ) => HTMLCanvasElement;
  private renderIdentity: string;
  private viewport: Box | null = null;
  private unsubscribe?: () => void;
  private visibleTiles = new Map<string, { coord: TileCoord; canvas: TCanvas }>();
  private visibleOrder: TileCoord[] = [];
  private touchedTilesByShape = new Map<string, Set<string>>();
  private lastTilesByShape = new Map<string, Set<string>>();
  private pendingBakeTiles = new Set<string>();
  private invalidateAll = false;

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
    this.backgroundColor = options.backgroundColor;
    this.baker = options.baker;
    this.snapshotAdapter = options.snapshotAdapter;
    this.snapshotStore =
      options.snapshotStore ?? createInMemorySnapshotStore<TSnapshot>();
    this.createViewportSnapshotCanvas = options.createViewportSnapshotCanvas;
    this.renderIdentity = options.renderIdentity ?? "";
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

  setRenderIdentity(identity: string): void {
    if (!identity || identity === this.renderIdentity) {
      return;
    }
    this.renderIdentity = identity;
    this.snapshotStore.clearSnapshots?.();
    this.pendingBakeTiles.clear();
    this.invalidateAll = true;
    this.releaseAllVisibleTiles();
    if (this.viewport) {
      const nextVisible = getVisibleTileCoords(this.viewport, this.tileSize);
      this.syncVisibleTiles(nextVisible);
    } else {
      this.visibleOrder = [];
    }
  }

  getShapeBounds(
    shapes: AnyShape[],
  ): ReturnType<typeof getOrderedShapesBounds> {
    return getOrderedShapesBounds(shapes, this.shapeHandlers);
  }

  renderShapes(ctx: CanvasRenderingContext2D, shapes: Shape[]): void {
    if (this.backgroundColor) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
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
      this.snapshotStore.deleteSnapshot(this.snapshotKeyForCoordKey(key));
    }
    this.touchedTilesByShape.set(shapeId, new Set());
  }

  scheduleBakeForShapes(shapeIds: Iterable<string>): void {
    for (const shapeId of shapeIds) {
      this.scheduleBakeForShape(shapeId);
    }
  }

  scheduleBakeForClear(): void {
    perfAddCounter("tileRenderer.scheduleBakeForClear.calls");
    this.invalidateAll = true;
    this.pendingBakeTiles.clear();
    this.snapshotStore.clearSnapshots?.();
  }

  getPendingBakeTiles(): TileCoord[] {
    const tiles: TileCoord[] = [];
    for (const key of this.pendingBakeTiles) {
      tiles.push(tileKeyToCoord(key));
    }
    return tiles;
  }

  async bakePendingTiles(): Promise<void> {
    const bakeStartMs = perfNowMs();
    perfAddCounter("tileRenderer.bakePendingTiles.calls");
    if (perfFlagEnabled("skipTileBakeExecution")) {
      perfAddCounter("tileRenderer.bakePendingTiles.skipped");
      return;
    }
    if (!this.baker) return;
    if (this.invalidateAll) {
      perfAddCounter("tileRenderer.bakePendingTiles.fullInvalidationRuns");
      perfAddCounter(
        "tileRenderer.bakePendingTiles.tilesBaked",
        this.visibleTiles.size,
      );
      for (const entry of this.visibleTiles.values()) {
        await this.baker.bakeTile(entry.coord, entry.canvas);
        if (this.snapshotAdapter) {
          const snapshot = this.snapshotAdapter.captureSnapshot(entry.canvas);
          this.snapshotStore.setSnapshot(
            this.snapshotKeyForCoord(entry.coord),
            snapshot,
          );
        }
      }
      this.invalidateAll = false;
      perfAddTimingMs("tileRenderer.bakePendingTiles.ms", perfNowMs() - bakeStartMs);
      return;
    }
    perfAddCounter(
      "tileRenderer.bakePendingTiles.tilesBaked",
      this.pendingBakeTiles.size,
    );
    for (const key of this.pendingBakeTiles) {
      const entry = this.visibleTiles.get(key);
      if (!entry) continue;
      await this.baker.bakeTile(entry.coord, entry.canvas);
      if (this.snapshotAdapter) {
        const snapshot = this.snapshotAdapter.captureSnapshot(entry.canvas);
        this.snapshotStore.setSnapshot(
          this.snapshotKeyForCoordKey(key),
          snapshot,
        );
      }
    }
    this.pendingBakeTiles.clear();
    perfAddTimingMs("tileRenderer.bakePendingTiles.ms", perfNowMs() - bakeStartMs);
  }

  getTilePixelRatio(): number {
    return this.computeTilePixelRatio();
  }

  async captureViewportSnapshot(scale = 1): Promise<CanvasImageSource | null> {
    const captureStartMs = perfNowMs();
    perfAddCounter("tileRenderer.captureViewportSnapshot.calls");
    if (perfFlagEnabled("skipSnapshotCapture")) {
      perfAddCounter("tileRenderer.captureViewportSnapshot.skipped");
      return null;
    }
    if (!this.viewport) {
      return null;
    }
    await this.bakePendingTiles();
    const snapshotScale =
      Number.isFinite(scale) && scale > 0 ? scale : 1;
    const viewportMin = new Vec2(this.viewport.min);
    const viewportMax = new Vec2(this.viewport.max);
    const scaledViewportSize = new Vec2(viewportMax)
      .sub(viewportMin)
      .mul([snapshotScale, snapshotScale]);
    const width = Math.max(
      1,
      Math.ceil(getX(scaledViewportSize)),
    );
    const height = Math.max(
      1,
      Math.ceil(getY(scaledViewportSize)),
    );
    const snapshotCanvas = this.createViewportSnapshotCanvas?.(width, height);
    const fallbackCanvas =
      snapshotCanvas ?? createDomSnapshotCanvas(width, height);
    if (!fallbackCanvas) {
      return null;
    }
    const ctx = fallbackCanvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (this.backgroundColor) {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
    for (const tile of this.visibleTiles.values()) {
      const tileOrigin = new Vec2(
        tile.coord.x * this.tileSize,
        tile.coord.y * this.tileSize,
      )
        .sub(viewportMin)
        .mul([snapshotScale, snapshotScale]);
      const destTileSize = this.tileSize * snapshotScale;
      const source = tile.canvas as unknown as Partial<{
        width: number;
        height: number;
      }>;
      const sourceWidth =
        typeof source.width === "number" ? source.width : destTileSize;
      const sourceHeight =
        typeof source.height === "number" ? source.height : destTileSize;
      ctx.drawImage(
        tile.canvas as unknown as CanvasImageSource,
        0,
        0,
        sourceWidth,
        sourceHeight,
        getX(tileOrigin),
        getY(tileOrigin),
        destTileSize,
        destTileSize,
      );
    }
    perfAddTimingMs(
      "tileRenderer.captureViewportSnapshot.ms",
      perfNowMs() - captureStartMs,
    );
    return fallbackCanvas;
  }

  private syncVisibleTiles(nextVisible: TileCoord[]): void {
    const nextKeys = new Set<string>();
    for (const coord of nextVisible) {
      const key = tileKey(coord);
      nextKeys.add(key);
      if (!this.visibleTiles.has(key)) {
        const canvas = this.tileProvider.getTileCanvas(coord);
        this.visibleTiles.set(key, { coord, canvas });
        const snapshot = this.snapshotStore.getSnapshot(
          this.snapshotKeyForCoord(coord),
        );
        if (
          snapshot &&
          this.snapshotAdapter &&
          !this.pendingBakeTiles.has(key) &&
          !this.invalidateAll
        ) {
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

  private releaseAllVisibleTiles(): void {
    for (const entry of this.visibleTiles.values()) {
      this.tileProvider.releaseTileCanvas?.(entry.coord, entry.canvas);
    }
    this.visibleTiles.clear();
  }

  private computeTilePixelRatio(): number {
    for (const entry of this.visibleTiles.values()) {
      const canvas = entry.canvas as unknown as Partial<{ width: number }>;
      if (typeof canvas.width !== "number" || canvas.width <= 0) {
        continue;
      }
      const scale = canvas.width / this.tileSize;
      if (Number.isFinite(scale) && scale > 0) {
        return scale;
      }
    }
    return 1;
  }

  private snapshotKeyForCoord(coord: TileCoord): string {
    const base = tileKey(coord);
    if (!this.renderIdentity) {
      return base;
    }
    return `${this.renderIdentity}|${base}`;
  }

  private snapshotKeyForCoordKey(coordKey: string): string {
    if (!this.renderIdentity) {
      return coordKey;
    }
    return `${this.renderIdentity}|${coordKey}`;
  }
}

function createDomSnapshotCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export type {
  TileBaker,
  TileCoord,
  TileProvider,
  TileSnapshotAdapter,
  TileSnapshotStore,
} from "./types";
export {
  createDomLayerController,
  createDomTileProvider,
  type DomLayerController,
  type DomTileProviderOptions,
} from "./dom";
export { TILE_SIZE } from "./constants";
export { getVisibleTileCoords, tileKey, tileKeyToCoord } from "./tiles";
export { createInMemorySnapshotStore } from "./snapshots";
export { HotLayer, type HotLayerOptions } from "./hotLayer";
export { type Viewport, applyViewportToContext } from "./viewport";
export { RasterSession, type RasterSessionOptions } from "./session";
