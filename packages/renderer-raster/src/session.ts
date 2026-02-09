import type { DirtyState, DrawingStore } from "@smalldraw/core";
import type { HotLayer } from "./hotLayer";
import type { TileRenderer } from "./index";
import {
  perfAddCounter,
  perfAddTimingMs,
  perfFlagEnabled,
  perfNowMs,
} from "./perfDebug";

export interface RasterSessionOptions {
  onBakeError?: (error: unknown) => void;
  layerController?: {
    setMode: (mode: "tiles" | "hot") => void;
  };
}

/**
 * Coordinates the hot-layer draw path with tile invalidation/baking.
 * Call render() from DrawingStore.onRenderNeeded.
 */
export class RasterSession<TCanvas = HTMLCanvasElement, TSnapshot = unknown> {
  private readonly tileRenderer: TileRenderer<TCanvas, TSnapshot>;
  private readonly hotLayer: HotLayer;
  private readonly store: DrawingStore;
  private readonly onBakeError?: (error: unknown) => void;
  private readonly layerController?: {
    setMode: (mode: "tiles" | "hot") => void;
  };
  private hasBackdropSnapshot = false;
  private captureInFlight: Promise<void> | null = null;
  private skipBackdropUntilStrokeEnd = false;
  private knownClearShapeIds = new Set<string>();
  private bakeQueue: Promise<void> = Promise.resolve();
  private forceFullHotRenderOnce = false;
  private hadRenderableShapes = false;

  constructor(
    store: DrawingStore,
    tileRenderer: TileRenderer<TCanvas, TSnapshot>,
    hotLayer: HotLayer,
    options: RasterSessionOptions = {},
  ) {
    this.store = store;
    this.tileRenderer = tileRenderer;
    this.hotLayer = hotLayer;
    this.onBakeError = options.onBakeError;
    this.layerController = options.layerController;
    this.layerController?.setMode("tiles");
  }

  render(): void {
    const renderStartMs = perfNowMs();
    perfAddCounter("session.render.calls");
    if (perfFlagEnabled("skipSessionRender")) {
      perfAddCounter("session.render.skipped");
      return;
    }
    const docShapes = this.store.getDocument().shapes;
    const hadRenderableShapes = this.hadRenderableShapes;
    const hasRenderableShapes = Object.values(docShapes).some(
      (shape) => shape.type !== "clear",
    );
    this.hadRenderableShapes = hasRenderableShapes;
    const previousClearShapeIds = new Set(this.knownClearShapeIds);
    const drafts = this.store.getDrafts();
    const hasDrafts = drafts.length > 0;
    const preview = this.store.getPreview();
    const requiresTileBackdrop = hasDrafts;
    if (!hasDrafts) {
      this.layerController?.setMode("tiles");
    }
    if (requiresTileBackdrop) {
      if (
        !this.hasBackdropSnapshot &&
        !this.captureInFlight &&
        !this.skipBackdropUntilStrokeEnd
      ) {
        this.captureInFlight = this.captureBackdropSnapshot()
          .catch((error: unknown) => {
            this.onBakeError?.(error);
          })
          .finally(() => {
            this.captureInFlight = null;
            this.render();
          });
      }
      if (!this.hasBackdropSnapshot && !this.skipBackdropUntilStrokeEnd) {
        this.layerController?.setMode("tiles");
        perfAddTimingMs("session.render.ms", perfNowMs() - renderStartMs);
        return;
      }
    } else if (this.hasBackdropSnapshot) {
      this.hotLayer.setBackdrop(null);
      this.hasBackdropSnapshot = false;
      this.skipBackdropUntilStrokeEnd = false;
    } else {
      this.skipBackdropUntilStrokeEnd = false;
    }
    if (!perfFlagEnabled("skipHotLayerRender")) {
      const hotStartMs = perfNowMs();
      const dirtyBounds = this.forceFullHotRenderOnce
        ? null
        : (preview?.dirtyBounds ?? null);
      this.hotLayer.renderDrafts(drafts, {
        dirtyBounds,
      });
      this.forceFullHotRenderOnce = false;
      this.layerController?.setMode(hasDrafts ? "hot" : "tiles");
      perfAddTimingMs(
        "session.hotLayer.renderDrafts.ms",
        perfNowMs() - hotStartMs,
      );
    } else {
      perfAddCounter("session.hotLayer.skipped");
    }
    const renderStateStartMs = perfNowMs();
    const { dirtyState } = this.store.getRenderState();
    perfAddTimingMs(
      "session.store.getRenderState.ms",
      perfNowMs() - renderStateStartMs,
    );
    if (this.hasClearMutation(dirtyState, docShapes, previousClearShapeIds)) {
      this.updateKnownClearShapeIds(docShapes);
      if (!perfFlagEnabled("skipTileBakeScheduling")) {
        this.tileRenderer.scheduleBakeForClear();
        this.enqueueBake();
      } else {
        perfAddCounter("session.tileBakeScheduling.skipped");
      }
      perfAddTimingMs("session.render.ms", perfNowMs() - renderStartMs);
      return;
    }
    if (!hasDrafts && hadRenderableShapes && !hasRenderableShapes) {
      this.updateKnownClearShapeIds(docShapes);
      if (!perfFlagEnabled("skipTileBakeScheduling")) {
        this.tileRenderer.scheduleBakeForClear();
        this.enqueueBake();
      } else {
        perfAddCounter("session.tileBakeScheduling.skipped");
      }
      perfAddTimingMs("session.render.ms", perfNowMs() - renderStartMs);
      return;
    }
    const touchStartMs = perfNowMs();
    const touchedShapeIds = this.captureTouchedTiles(dirtyState);
    perfAddTimingMs(
      "session.captureTouchedTiles.ms",
      perfNowMs() - touchStartMs,
    );
    this.updateKnownClearShapeIds(docShapes);
    if (!touchedShapeIds.size) {
      perfAddTimingMs("session.render.ms", perfNowMs() - renderStartMs);
      return;
    }
    if (!perfFlagEnabled("skipTileBakeScheduling")) {
      this.tileRenderer.scheduleBakeForShapes(touchedShapeIds);
      this.enqueueBake();
    } else {
      perfAddCounter("session.tileBakeScheduling.skipped");
    }
    perfAddTimingMs("session.render.ms", perfNowMs() - renderStartMs);
  }

  async flushBakes(): Promise<void> {
    await this.bakeQueue;
  }

  private captureTouchedTiles(dirtyState: DirtyState): Set<string> {
    const touchedShapeIds = new Set<string>();
    const shapes = this.store.getDocument().shapes;

    for (const shapeId of dirtyState.dirty) {
      const shape = shapes[shapeId];
      if (!shape) continue;
      this.tileRenderer.updateTouchedTilesForShape(shape);
      touchedShapeIds.add(shapeId);
    }

    for (const shapeId of dirtyState.deleted) {
      touchedShapeIds.add(shapeId);
    }

    return touchedShapeIds;
  }

  private enqueueBake(): void {
    this.bakeQueue = this.bakeQueue
      .then(async () => {
        perfAddCounter("session.bakeQueue.flushes");
        await this.tileRenderer.bakePendingTiles();
      })
      .catch((error: unknown) => {
        this.onBakeError?.(error);
      });
  }

  private async captureBackdropSnapshot(): Promise<void> {
    if (perfFlagEnabled("skipSnapshotCapture")) {
      perfAddCounter("session.captureBackdropSnapshot.skipped");
      return;
    }
    const captureStartMs = perfNowMs();
    await this.flushBakes();
    const snapshot = await this.tileRenderer.captureViewportSnapshot(
      this.tileRenderer.getTilePixelRatio(),
    );
    perfAddCounter("session.captureBackdropSnapshot.calls");
    perfAddTimingMs(
      "session.captureBackdropSnapshot.ms",
      perfNowMs() - captureStartMs,
    );
    if (!this.store.getDrafts().length) {
      return;
    }
    if (!snapshot) {
      this.skipBackdropUntilStrokeEnd = true;
      return;
    }
    this.hotLayer.setBackdrop(snapshot ?? null);
    this.hasBackdropSnapshot = true;
    this.forceFullHotRenderOnce = true;
  }

  private updateKnownClearShapeIds(
    shapes: Record<string, { type: string }>,
  ): void {
    this.knownClearShapeIds.clear();
    for (const [shapeId, shape] of Object.entries(shapes)) {
      if (shape.type === "clear") {
        this.knownClearShapeIds.add(shapeId);
      }
    }
  }

  private hasClearMutation(
    dirtyState: DirtyState,
    shapes: Record<string, { type: string }>,
    previousClearShapeIds: Set<string>,
  ): boolean {
    for (const shapeId of dirtyState.dirty) {
      if (shapes[shapeId]?.type === "clear") {
        return true;
      }
    }
    for (const shapeId of dirtyState.deleted) {
      if (previousClearShapeIds.has(shapeId)) {
        return true;
      }
    }
    return false;
  }
}
