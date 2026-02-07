import type { DirtyState, DrawingStore } from "@smalldraw/core";
import type { HotLayer } from "./hotLayer";
import type { TileRenderer } from "./index";

export interface RasterSessionOptions {
  onBakeError?: (error: unknown) => void;
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
  private hasBackdropSnapshot = false;
  private captureInFlight: Promise<void> | null = null;
  private skipBackdropUntilStrokeEnd = false;
  private knownClearShapeIds = new Set<string>();
  private bakeQueue: Promise<void> = Promise.resolve();

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
  }

  render(): void {
    const docShapes = this.store.getDocument().shapes;
    const previousClearShapeIds = new Set(this.knownClearShapeIds);
    const drafts = this.store.getDrafts();
    const hasEraserDraft = drafts.some(isEraserDraft);
    if (hasEraserDraft) {
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
      if (!this.hasBackdropSnapshot && !this.skipBackdropUntilStrokeEnd) return;
    } else if (this.hasBackdropSnapshot) {
      this.hotLayer.setBackdrop(null);
      this.hasBackdropSnapshot = false;
      this.skipBackdropUntilStrokeEnd = false;
    } else {
      this.skipBackdropUntilStrokeEnd = false;
    }
    this.hotLayer.renderDrafts(drafts);
    const { dirtyState } = this.store.getRenderState();
    if (this.hasClearMutation(dirtyState, docShapes, previousClearShapeIds)) {
      this.updateKnownClearShapeIds(docShapes);
      this.tileRenderer.scheduleBakeForClear();
      this.enqueueBake();
      return;
    }
    const touchedShapeIds = this.captureTouchedTiles(dirtyState);
    this.updateKnownClearShapeIds(docShapes);
    if (!touchedShapeIds.size) return;
    this.tileRenderer.scheduleBakeForShapes(touchedShapeIds);
    this.enqueueBake();
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
        await this.tileRenderer.bakePendingTiles();
      })
      .catch((error: unknown) => {
        this.onBakeError?.(error);
      });
  }

  private async captureBackdropSnapshot(): Promise<void> {
    await this.flushBakes();
    const snapshot = await this.tileRenderer.captureViewportSnapshot();
    if (!this.store.getDrafts().some(isEraserDraft)) {
      return;
    }
    if (!snapshot) {
      this.skipBackdropUntilStrokeEnd = true;
      return;
    }
    this.hotLayer.setBackdrop(snapshot ?? null);
    this.hasBackdropSnapshot = true;
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

function isEraserDraft(shape: { style?: { stroke?: { compositeOp?: string } } }): boolean {
  return shape.style?.stroke?.compositeOp === "destination-out";
}
