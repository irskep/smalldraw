import type { AnyShape, DrawingLayer, DrawingStore } from "@smalldraw/core";
import { type Box, BoxOperations, Vec2 } from "@smalldraw/geometry";
import type { ShapeRendererRegistry } from "@smalldraw/renderer-canvas";
import {
  renderLayerStack,
  renderOrderedShapes,
} from "@smalldraw/renderer-canvas";
import { TILE_SIZE } from "./constants";
import { createDomTileProvider } from "./dom";
import type { DraftLayerComposite } from "./hotLayer";
import { TileRenderer } from "./index";
import { perfAddCounter, perfAddTimingMs, perfNowMs } from "./perfDebug";
import { createTileShapeFilter } from "./tileShapeFilter";

export type LayerRenderStrategy = "tile" | "canvas";

export function resolveLayerStrategy(layer: DrawingLayer): LayerRenderStrategy {
  if (layer.kind === "image") {
    return "canvas";
  }
  return "tile";
}

export interface LayerStack {
  setLayers(layers: DrawingLayer[]): void;
  setActiveLayer(layerId: string): void;
  updateViewport(width: number, height: number, dpr: number): void;
  setRenderIdentity(identity: string): void;
  routeDirtyShapes(
    dirtyShapeIds: Iterable<string>,
    deletedShapeIds: Iterable<string>,
  ): void;
  routeDirtyRegions(regionsByLayer: Map<string, Box[]>): void;
  routeDirtyShapeRegions(
    changesByLayer: Map<string, ShapeRegionChange[]>,
  ): void;
  scheduleFullInvalidation(): void;
  scheduleFullLayerInvalidation(layerId: string): void;
  flushBakes(): Promise<void>;
  prewarmActiveLayerDraftComposite(): void;
  beginActiveLayerDraftSession(): Promise<void>;
  endActiveLayerDraftSession(): void;
  getActiveLayerDraftComposite(): DraftLayerComposite | null;
  dispose(): void;
}

export interface ShapeRegionChange {
  shapeId: string;
  prevBounds: Box | null;
  nextBounds: Box | null;
}

interface LayerStackOptions {
  store: DrawingStore;
  host: HTMLElement;
  hotCanvas: HTMLCanvasElement;
  shapeRendererRegistry: ShapeRendererRegistry;
  resolveImage: (src: string) => CanvasImageSource | null;
  backgroundColor?: string;
}

interface LayerEntry {
  layer: DrawingLayer;
  strategy: LayerRenderStrategy;
  container: HTMLDivElement;
  backend: LayerBackend;
}

interface LayerBackend {
  updateLayer(layer: DrawingLayer): void;
  updateViewport(width: number, height: number, dpr: number): void;
  setRenderIdentity(identity: string): void;
  routeDirty(
    shapeIds: Iterable<string>,
    deletedShapeIds: Iterable<string>,
  ): void;
  routeDirtyRegions(regions: Box[]): void;
  routeDirtyShapeRegions(changes: ShapeRegionChange[]): void;
  scheduleFullInvalidation(): void;
  bakePending(): Promise<void>;
  captureBackdropSnapshot(): Promise<CanvasImageSource | null>;
  dispose(): void;
}

export function createLayerStack(options: LayerStackOptions): LayerStack & {
  flushBakes(): Promise<void>;
  scheduleFullInvalidation(): void;
} {
  return new LayerStackImpl(options);
}

class LayerStackImpl implements LayerStack {
  private readonly store: DrawingStore;
  private readonly host: HTMLElement;
  private readonly hotCanvas: HTMLCanvasElement;
  private readonly shapeRendererRegistry: ShapeRendererRegistry;
  private readonly resolveImage: (src: string) => CanvasImageSource | null;
  private readonly backgroundColor?: string;
  private readonly layersById = new Map<string, LayerEntry>();
  private readonly shapeLastKnownLayer = new Map<string, string>();
  private orderedLayerIds: string[] = [];
  private activeLayerId: string | null = null;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private viewportDpr = 1;
  private renderIdentity = "";
  private bakeQueue: Promise<void> = Promise.resolve();
  private activeLayerDraftComposite: DraftLayerComposite | null = null;
  private draftHiddenLayerIds: string[] = [];
  private compositeCache: {
    key: string;
    version: number;
    value: DraftLayerComposite | null;
    promise: Promise<DraftLayerComposite | null> | null;
  } | null = null;
  private compositeCacheVersion = 0;
  private draftSessionGeneration = 0;
  private disposed = false;

  constructor(options: LayerStackOptions) {
    this.store = options.store;
    this.host = options.host;
    this.hotCanvas = options.hotCanvas;
    this.shapeRendererRegistry = options.shapeRendererRegistry;
    this.resolveImage = options.resolveImage;
    this.backgroundColor = options.backgroundColor;
    if (this.hotCanvas.parentElement !== this.host) {
      this.host.appendChild(this.hotCanvas);
    }
    this.hotCanvas.style.visibility = "hidden";
    this.rebuildShapeLayerIndex();
  }

  setLayers(layers: DrawingLayer[]): void {
    const ordered = [...layers].sort((a, b) => {
      if (a.zIndex === b.zIndex) {
        return 0;
      }
      return a.zIndex < b.zIndex ? -1 : 1;
    });
    const nextIds = new Set(ordered.map((layer) => layer.id));

    for (const [layerId, entry] of this.layersById) {
      if (nextIds.has(layerId)) {
        continue;
      }
      entry.backend.dispose();
      entry.container.remove();
      this.layersById.delete(layerId);
    }

    let createdNewBackend = false;
    for (const layer of ordered) {
      const existing = this.layersById.get(layer.id);
      const strategy = resolveLayerStrategy(layer);
      if (existing && existing.strategy === strategy) {
        existing.layer = layer;
        existing.backend.updateLayer(layer);
        this.applyLayerVisibility(existing.container, layer);
        continue;
      }
      if (existing) {
        existing.backend.dispose();
        existing.container.remove();
      }
      const container = this.createLayerContainer(layer.id);
      const backend = this.createBackend(layer, strategy, container);
      backend.updateViewport(
        this.viewportWidth,
        this.viewportHeight,
        this.viewportDpr,
      );
      if (this.renderIdentity) {
        backend.setRenderIdentity(this.renderIdentity);
      }
      this.layersById.set(layer.id, {
        layer,
        strategy,
        container,
        backend,
      });
      this.applyLayerVisibility(container, layer);
      createdNewBackend = true;
    }

    this.orderedLayerIds = ordered.map((layer) => layer.id);
    if (
      this.activeLayerId === null ||
      !this.layersById.has(this.activeLayerId)
    ) {
      this.activeLayerId = this.orderedLayerIds[0] ?? null;
    }
    this.reorderDom();
    if (createdNewBackend) {
      this.scheduleFullInvalidation();
    } else {
      this.invalidateCompositeCache();
      this.enqueueBake();
    }
  }

  setActiveLayer(layerId: string): void {
    if (!this.layersById.has(layerId)) {
      return;
    }
    if (this.activeLayerId === layerId) return;
    this.endActiveLayerDraftSession();
    this.invalidateCompositeCache();
    this.activeLayerId = layerId;
    this.reorderDom();
    this.prewarmActiveLayerDraftComposite();
  }

  updateViewport(width: number, height: number, dpr: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.viewportDpr = normalizeDpr(dpr);
    for (const entry of this.layersById.values()) {
      entry.backend.updateViewport(
        this.viewportWidth,
        this.viewportHeight,
        this.viewportDpr,
      );
    }
    this.invalidateCompositeCache();
    this.prewarmActiveLayerDraftComposite();
  }

  setRenderIdentity(identity: string): void {
    if (!identity || identity === this.renderIdentity) {
      return;
    }
    this.renderIdentity = identity;
    for (const entry of this.layersById.values()) {
      entry.backend.setRenderIdentity(identity);
    }
    this.scheduleFullInvalidation();
  }

  routeDirtyShapes(
    dirtyShapeIds: Iterable<string>,
    deletedShapeIds: Iterable<string>,
  ): void {
    const dirtyByLayer = new Map<string, Set<string>>();
    const deletedByLayer = new Map<string, Set<string>>();
    const shapes = this.store.getDocument().shapes;

    for (const shapeId of dirtyShapeIds) {
      const shape = shapes[shapeId];
      if (!shape) {
        continue;
      }
      const layerId = shape.layerId ?? "default";
      this.shapeLastKnownLayer.set(shapeId, layerId);
      addToBucket(dirtyByLayer, layerId, shapeId);
    }
    for (const shapeId of deletedShapeIds) {
      const layerId = this.shapeLastKnownLayer.get(shapeId);
      if (!layerId) {
        continue;
      }
      addToBucket(deletedByLayer, layerId, shapeId);
      this.shapeLastKnownLayer.delete(shapeId);
    }

    const touchedLayerIds = new Set([
      ...dirtyByLayer.keys(),
      ...deletedByLayer.keys(),
    ]);
    for (const layerId of touchedLayerIds) {
      const entry = this.layersById.get(layerId);
      if (!entry) {
        continue;
      }
      const dirty = dirtyByLayer.get(layerId) ?? new Set<string>();
      const deleted = deletedByLayer.get(layerId) ?? new Set<string>();
      perfAddCounter(`layer.${layerId}.dirty.count`, dirty.size + deleted.size);
      entry.backend.routeDirty(dirty, deleted);
    }
    if (touchedLayerIds.size > 0) {
      this.invalidateCompositeCache();
      this.enqueueBake();
      this.prewarmActiveLayerDraftComposite();
    }
  }

  routeDirtyRegions(regionsByLayer: Map<string, Box[]>): void {
    let touched = false;
    for (const [layerId, regions] of regionsByLayer) {
      if (regions.length === 0) {
        continue;
      }
      const entry = this.layersById.get(layerId);
      if (!entry) {
        continue;
      }
      entry.backend.routeDirtyRegions(regions);
      touched = true;
    }
    if (touched) {
      this.invalidateCompositeCache();
      this.enqueueBake();
      this.prewarmActiveLayerDraftComposite();
    }
  }

  routeDirtyShapeRegions(
    changesByLayer: Map<string, ShapeRegionChange[]>,
  ): void {
    let touched = false;
    for (const [layerId, changes] of changesByLayer) {
      if (changes.length === 0) {
        continue;
      }
      const entry = this.layersById.get(layerId);
      if (!entry) {
        continue;
      }
      entry.backend.routeDirtyShapeRegions(changes);
      touched = true;
    }
    if (touched) {
      this.invalidateCompositeCache();
      this.enqueueBake();
      this.prewarmActiveLayerDraftComposite();
    }
  }

  scheduleFullLayerInvalidation(layerId: string): void {
    const entry = this.layersById.get(layerId);
    if (!entry) {
      return;
    }
    entry.backend.scheduleFullInvalidation();
    this.invalidateCompositeCache();
    this.enqueueBake();
    this.prewarmActiveLayerDraftComposite();
  }

  prewarmActiveLayerDraftComposite(): void {
    if (
      this.disposed ||
      !this.activeLayerId ||
      !this.layersById.has(this.activeLayerId)
    ) {
      return;
    }
    const key = this.getCompositeCacheKey();
    const version = this.compositeCacheVersion;
    if (this.compositeCache?.key === key) {
      return;
    }
    const promise = this.captureDraftComposite();
    this.compositeCache = { key, version, value: null, promise };
    promise
      .then((value) => {
        if (
          this.compositeCache?.key === key &&
          this.compositeCache.version === version
        ) {
          this.compositeCache = { key, version, value, promise: null };
        }
      })
      .catch(() => {
        if (
          this.compositeCache?.key === key &&
          this.compositeCache.version === version
        ) {
          this.compositeCache = null;
        }
      });
  }

  async beginActiveLayerDraftSession(): Promise<void> {
    const active = this.getActiveEntry();
    if (!active) {
      this.activeLayerDraftComposite = null;
      return;
    }
    const generation = ++this.draftSessionGeneration;
    const backdropStartMs = perfNowMs();
    const composite = await this.getOrCaptureDraftComposite();
    if (this.disposed || generation !== this.draftSessionGeneration) return;
    this.activeLayerDraftComposite = composite;
    perfAddTimingMs("hot.backdrop.ms", perfNowMs() - backdropStartMs);
    if (!this.activeLayerDraftComposite) {
      return;
    }
    this.hideAllLayerContainersForDraft();
  }

  endActiveLayerDraftSession(): void {
    this.draftSessionGeneration++;
    for (const layerId of this.draftHiddenLayerIds) {
      const entry = this.layersById.get(layerId);
      if (entry) {
        entry.container.style.display = "";
        this.applyLayerVisibility(entry.container, entry.layer);
      }
    }
    this.draftHiddenLayerIds = [];
    this.activeLayerDraftComposite = null;
  }

  getActiveLayerDraftComposite(): DraftLayerComposite | null {
    return this.activeLayerDraftComposite;
  }

  scheduleFullInvalidation(): void {
    for (const entry of this.layersById.values()) {
      entry.backend.scheduleFullInvalidation();
    }
    this.invalidateCompositeCache();
    this.enqueueBake();
    this.prewarmActiveLayerDraftComposite();
  }

  async flushBakes(): Promise<void> {
    let pending: Promise<void>;
    do {
      pending = this.bakeQueue;
      await pending;
    } while (pending !== this.bakeQueue && !this.disposed);
  }

  dispose(): void {
    this.disposed = true;
    this.endActiveLayerDraftSession();
    this.invalidateCompositeCache();
    for (const entry of this.layersById.values()) {
      entry.backend.dispose();
      entry.container.remove();
    }
    this.layersById.clear();
    this.orderedLayerIds = [];
    this.activeLayerDraftComposite = null;
    this.draftHiddenLayerIds = [];
    this.compositeCache = null;
  }

  private createLayerContainer(layerId: string): HTMLDivElement {
    const element = document.createElement("div");
    element.dataset.layerId = layerId;
    element.style.position = "absolute";
    element.style.inset = "0";
    element.style.pointerEvents = "none";
    element.style.overflow = "hidden";
    return element;
  }

  private createBackend(
    layer: DrawingLayer,
    strategy: LayerRenderStrategy,
    container: HTMLDivElement,
  ): LayerBackend {
    if (strategy === "canvas") {
      return new CanvasLayerBackend({
        store: this.store,
        layer,
        container,
        shapeRendererRegistry: this.shapeRendererRegistry,
        resolveImage: this.resolveImage,
        backgroundColor: this.backgroundColor,
      });
    }
    return new TileLayerBackend({
      store: this.store,
      layer,
      container,
      shapeRendererRegistry: this.shapeRendererRegistry,
    });
  }

  private reorderDom(): void {
    for (const layerId of this.orderedLayerIds) {
      const entry = this.layersById.get(layerId);
      if (entry) {
        this.host.appendChild(entry.container);
      }
    }
    const activeIndex =
      this.activeLayerId === null
        ? -1
        : this.orderedLayerIds.indexOf(this.activeLayerId);
    if (activeIndex < 0 || activeIndex >= this.orderedLayerIds.length - 1) {
      this.host.appendChild(this.hotCanvas);
      return;
    }
    const nextLayerId = this.orderedLayerIds[activeIndex + 1];
    const nextEntry = this.layersById.get(nextLayerId);
    if (!nextEntry) {
      this.host.appendChild(this.hotCanvas);
      return;
    }
    this.host.insertBefore(this.hotCanvas, nextEntry.container);
  }

  private getActiveEntry(): LayerEntry | null {
    if (!this.activeLayerId) {
      return null;
    }
    return this.layersById.get(this.activeLayerId) ?? null;
  }

  private applyLayerVisibility(
    container: HTMLElement,
    layer: DrawingLayer,
  ): void {
    container.style.visibility = layer.visible === false ? "hidden" : "";
  }

  private hideAllLayerContainersForDraft(): void {
    this.draftHiddenLayerIds = [];
    for (const [layerId, entry] of this.layersById) {
      entry.container.style.display = "none";
      this.draftHiddenLayerIds.push(layerId);
    }
  }

  private async getOrCaptureDraftComposite(): Promise<DraftLayerComposite | null> {
    while (!this.disposed) {
      this.prewarmActiveLayerDraftComposite();
      const cache = this.compositeCache;
      if (!cache) return null;
      const value = cache.promise ? await cache.promise : cache.value;
      if (this.disposed) return null;
      if (
        cache.version === this.compositeCacheVersion &&
        cache.key === this.getCompositeCacheKey()
      ) {
        return value;
      }
    }
    return null;
  }

  private async captureDraftComposite(): Promise<DraftLayerComposite | null> {
    if (!this.activeLayerId) {
      return null;
    }
    await this.flushBakes();
    const activeIndex = this.orderedLayerIds.indexOf(this.activeLayerId);
    if (activeIndex < 0) {
      return null;
    }
    const visibleLayerIds = this.orderedLayerIds.filter((layerId) => {
      const entry = this.layersById.get(layerId);
      return entry && entry.layer.visible !== false;
    });
    const belowLayerIds = visibleLayerIds.filter(
      (layerId) => this.orderedLayerIds.indexOf(layerId) < activeIndex,
    );
    const aboveLayerIds = visibleLayerIds.filter(
      (layerId) => this.orderedLayerIds.indexOf(layerId) > activeIndex,
    );
    const activeLayerIds = visibleLayerIds.includes(this.activeLayerId)
      ? [this.activeLayerId]
      : [];

    return {
      width: this.viewportWidth,
      height: this.viewportHeight,
      below: await this.captureLayerGroupSnapshot(belowLayerIds),
      active: await this.captureLayerGroupSnapshot(activeLayerIds),
      above: await this.captureLayerGroupSnapshot(aboveLayerIds),
    };
  }

  private async captureLayerGroupSnapshot(
    layerIds: string[],
  ): Promise<CanvasImageSource | null> {
    if (!layerIds.length) {
      return null;
    }
    const canvas = this.createSnapshotCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const layerId of layerIds) {
      const entry = this.layersById.get(layerId);
      if (!entry || entry.layer.visible === false) {
        continue;
      }
      const snapshot = await entry.backend.captureBackdropSnapshot();
      if (!snapshot) {
        continue;
      }
      ctx.drawImage(snapshot, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }

  private createSnapshotCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(
      1,
      Math.round(this.viewportWidth * this.viewportDpr),
    );
    canvas.height = Math.max(
      1,
      Math.round(this.viewportHeight * this.viewportDpr),
    );
    return canvas;
  }

  private getCompositeCacheKey(): string {
    return [
      this.renderIdentity,
      this.activeLayerId ?? "",
      this.viewportWidth,
      this.viewportHeight,
      this.viewportDpr,
      ...this.orderedLayerIds.map((layerId) => {
        const entry = this.layersById.get(layerId);
        return entry
          ? `${entry.layer.id}:${entry.layer.kind}:${entry.layer.zIndex}:${entry.layer.visible === false ? "hidden" : "visible"}`
          : layerId;
      }),
    ].join("|");
  }

  private invalidateCompositeCache(): void {
    this.compositeCacheVersion += 1;
    this.compositeCache = null;
  }

  private enqueueBake(): void {
    // A failed bake remains observable through flushBakes, but does not poison
    // subsequent invalidations after the underlying problem is corrected.
    this.bakeQueue = this.bakeQueue
      .catch(() => {})
      .then(async () => {
        if (this.disposed) return;
        for (const layerId of this.orderedLayerIds) {
          const entry = this.layersById.get(layerId);
          if (!entry) {
            continue;
          }
          await entry.backend.bakePending();
          if (this.disposed) return;
        }
      });
    void this.bakeQueue.catch(() => {});
  }

  private rebuildShapeLayerIndex(): void {
    this.shapeLastKnownLayer.clear();
    for (const shape of Object.values(this.store.getDocument().shapes)) {
      this.shapeLastKnownLayer.set(shape.id, shape.layerId ?? "default");
    }
  }
}

class TileLayerBackend implements LayerBackend {
  private readonly store: DrawingStore;
  private readonly layerId: string;
  private layer: DrawingLayer;
  private readonly tileRenderer: TileRenderer<HTMLCanvasElement, unknown>;
  private readonly selectTileShapes: ReturnType<typeof createTileShapeFilter>;
  private width = 1;
  private height = 1;
  private dpr = 1;

  constructor(options: {
    store: DrawingStore;
    layer: DrawingLayer;
    container: HTMLElement;
    shapeRendererRegistry: ShapeRendererRegistry;
  }) {
    this.store = options.store;
    this.layer = options.layer;
    this.layerId = options.layer.id;
    this.selectTileShapes = createTileShapeFilter(
      this.store.getShapeHandlers(),
    );
    const tileProvider = createDomTileProvider(options.container, {
      getPixelRatio: () => this.dpr,
      getTileIdentity: () => this.layerId,
    });
    this.tileRenderer = new TileRenderer(this.store, tileProvider, {
      shapeRendererRegistry: options.shapeRendererRegistry,
      baker: {
        bakeTile: async (coord, canvas) => {
          const expectedTilePixels = Math.max(
            1,
            Math.round(TILE_SIZE * this.dpr),
          );
          if (canvas.width !== expectedTilePixels) {
            canvas.width = expectedTilePixels;
          }
          if (canvas.height !== expectedTilePixels) {
            canvas.height = expectedTilePixels;
          }
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return;
          }
          const tileScaleX = canvas.width / TILE_SIZE;
          const tileScaleY = canvas.height / TILE_SIZE;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.setTransform(
            tileScaleX,
            0,
            0,
            tileScaleY,
            -coord.x * TILE_SIZE * tileScaleX,
            -coord.y * TILE_SIZE * tileScaleY,
          );
          try {
            const orderedShapes = this.store.getOrderedShapesForLayer(
              this.layerId,
            );
            const guard = 2 / Math.min(tileScaleX, tileScaleY);
            const tileBounds = BoxOperations.fromMinAndSize(
              new Vec2(coord.x, coord.y).scale(TILE_SIZE).sub([guard, guard]),
              new Vec2(TILE_SIZE + 2 * guard),
            );
            // A one-tile viewport usually contains the whole drawing. Avoid
            // paying to populate a bounds cache when there is no tile fan-out.
            const shapes =
              this.width <= TILE_SIZE && this.height <= TILE_SIZE
                ? orderedShapes
                : this.selectTileShapes(orderedShapes, tileBounds);
            perfAddCounter(
              `layer.${this.layerId}.bake.candidates`,
              orderedShapes.length,
            );
            perfAddCounter(
              `layer.${this.layerId}.bake.replayed`,
              shapes.length,
            );
            renderOrderedShapes(ctx, shapes, {
              registry: options.shapeRendererRegistry,
              geometryHandlerRegistry: this.store.getShapeHandlers(),
              clear: false,
            });
          } finally {
            ctx.restore();
          }
        },
      },
    });
  }

  updateLayer(layer: DrawingLayer): void {
    this.layer = layer;
  }

  updateViewport(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.tileRenderer.updateViewport({
      min: [0, 0],
      max: [this.width, this.height],
    });
  }

  setRenderIdentity(identity: string): void {
    this.tileRenderer.setRenderIdentity(`${identity}|${this.layerId}`);
  }

  routeDirty(
    shapeIds: Iterable<string>,
    deletedShapeIds: Iterable<string>,
  ): void {
    const touchedShapeIds = new Set<string>();
    for (const shapeId of shapeIds) {
      const shape = this.store.getDocument().shapes[shapeId];
      if (!shape) {
        continue;
      }
      this.tileRenderer.updateTouchedTilesForShape(shape as AnyShape);
      touchedShapeIds.add(shapeId);
    }
    for (const shapeId of deletedShapeIds) {
      touchedShapeIds.add(shapeId);
    }
    if (touchedShapeIds.size > 0) {
      this.tileRenderer.scheduleBakeForShapes(touchedShapeIds);
    }
  }

  routeDirtyRegions(regions: Box[]): void {
    for (const region of regions) {
      this.tileRenderer.markRegionDirty(region);
    }
  }

  routeDirtyShapeRegions(changes: ShapeRegionChange[]): void {
    for (const change of changes) {
      this.tileRenderer.markShapeRegionDirty(
        change.shapeId,
        change.prevBounds,
        change.nextBounds,
      );
    }
  }

  scheduleFullInvalidation(): void {
    perfAddCounter(`layer.${this.layerId}.fullInvalidations`);
    this.tileRenderer.scheduleBakeForClear();
  }

  async bakePending(): Promise<void> {
    const bakeStartMs = perfNowMs();
    const bakeTiles = this.tileRenderer.getPendingBakeTiles().length;
    perfAddCounter(`layer.${this.layerId}.bake.tiles`, bakeTiles);
    await this.tileRenderer.bakePendingTiles();
    perfAddTimingMs(`layer.${this.layerId}.bake.ms`, perfNowMs() - bakeStartMs);
  }

  async captureBackdropSnapshot(): Promise<CanvasImageSource | null> {
    const captureStartMs = perfNowMs();
    const snapshot = await this.tileRenderer.captureViewportSnapshot(
      this.tileRenderer.getTilePixelRatio(),
    );
    perfAddTimingMs(
      `layer.${this.layerId}.snapshot.ms`,
      perfNowMs() - captureStartMs,
    );
    return snapshot;
  }

  dispose(): void {
    this.tileRenderer.dispose();
  }
}

class CanvasLayerBackend implements LayerBackend {
  private readonly store: DrawingStore;
  private layer: DrawingLayer;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly shapeRendererRegistry: ShapeRendererRegistry;
  private readonly resolveImage: (src: string) => CanvasImageSource | null;
  private readonly backgroundColor?: string;
  private dirty = true;
  private width = 1;
  private height = 1;
  private dpr = 1;

  constructor(options: {
    store: DrawingStore;
    layer: DrawingLayer;
    container: HTMLElement;
    shapeRendererRegistry: ShapeRendererRegistry;
    resolveImage: (src: string) => CanvasImageSource | null;
    backgroundColor?: string;
  }) {
    this.store = options.store;
    this.layer = options.layer;
    this.shapeRendererRegistry = options.shapeRendererRegistry;
    this.resolveImage = options.resolveImage;
    this.backgroundColor = options.backgroundColor;
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    options.container.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CanvasLayerBackend requires a 2D context.");
    }
    this.ctx = ctx as CanvasRenderingContext2D;
  }

  updateLayer(layer: DrawingLayer): void {
    this.layer = layer;
    this.dirty = true;
  }

  updateViewport(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    const nextWidth = Math.max(1, Math.round(this.width * this.dpr));
    const nextHeight = Math.max(1, Math.round(this.height * this.dpr));
    if (this.canvas.width !== nextWidth) {
      this.canvas.width = nextWidth;
    }
    if (this.canvas.height !== nextHeight) {
      this.canvas.height = nextHeight;
    }
    this.dirty = true;
  }

  setRenderIdentity(_identity: string): void {
    this.dirty = true;
  }

  routeDirty(
    shapeIds: Iterable<string>,
    deletedShapeIds: Iterable<string>,
  ): void {
    let touchedCount = 0;
    for (const _shapeId of shapeIds) {
      touchedCount += 1;
    }
    for (const _shapeId of deletedShapeIds) {
      touchedCount += 1;
    }
    if (touchedCount > 0) {
      this.dirty = true;
    }
  }

  routeDirtyRegions(_regions: Box[]): void {
    this.dirty = true;
  }

  routeDirtyShapeRegions(_changes: ShapeRegionChange[]): void {
    this.dirty = true;
  }

  scheduleFullInvalidation(): void {
    perfAddCounter(`layer.${this.layer.id}.fullInvalidations`);
    this.dirty = true;
  }

  async bakePending(): Promise<void> {
    if (!this.dirty) {
      return;
    }
    const bakeStartMs = perfNowMs();
    this.redraw();
    this.dirty = false;
    perfAddCounter(`layer.${this.layer.id}.bake.tiles`, 1);
    perfAddTimingMs(
      `layer.${this.layer.id}.bake.ms`,
      perfNowMs() - bakeStartMs,
    );
  }

  async captureBackdropSnapshot(): Promise<CanvasImageSource | null> {
    const captureStartMs = perfNowMs();
    if (this.dirty) {
      this.redraw();
      this.dirty = false;
    }
    perfAddTimingMs(
      `layer.${this.layer.id}.snapshot.ms`,
      perfNowMs() - captureStartMs,
    );
    return this.canvas;
  }

  dispose(): void {
    this.canvas.remove();
  }

  private redraw(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.backgroundColor && this.layer.id === "background") {
      this.ctx.fillStyle = this.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    const scaleX = this.canvas.width / this.width;
    const scaleY = this.canvas.height / this.height;
    this.ctx.save();
    this.ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    const shapes = this.store.getOrderedShapesForLayer(this.layer.id);
    renderLayerStack(this.ctx, [this.layer], shapes, {
      registry: this.shapeRendererRegistry,
      geometryHandlerRegistry: this.store.getShapeHandlers(),
      clear: false,
      resolveImage: this.resolveImage,
      documentWidth: this.width,
      documentHeight: this.height,
    });
    this.ctx.restore();
  }
}

function addToBucket(
  bucket: Map<string, Set<string>>,
  layerId: string,
  shapeId: string,
): void {
  const existing = bucket.get(layerId);
  if (existing) {
    existing.add(shapeId);
    return;
  }
  bucket.set(layerId, new Set([shapeId]));
}

function normalizeDpr(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return value;
}
