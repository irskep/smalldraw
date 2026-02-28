# Step 3: Pipeline Consumes the Diff

## Scope

Update the raster pipeline in `apps/splatterboard` to consume `ApplyDocumentDiff` alongside the existing shape-ID dirty state. Compute bounds from `prevDoc`/`nextDoc` in the pipeline (renderer-side), convert to invalidation regions, and route them to the layer stack.

Then, remove the temporary dual-write from step 2: `applyDocument()` and `resetToDocument()` stop writing to `dirtyShapeIds` / `dirtyShapeIdsByLayer` / `deletedShapeIds` / `deletedShapeIdsByLayer`. The pipeline now consumes the diff for external syncs and shape-ID state for local actions only.

This is the step where the optimization takes effect.

## Files to modify

### `apps/splatterboard/src/render/createRasterPipeline.ts`

#### Modify: `renderInternal()` (line 156)

Current flow:
1. `store.consumeDirtyStateByLayer()`
2. flatten into `dirtyShapeIds` / `deletedShapeIds`
3. route to `layerStack.routeDirtyShapes(...)` or `layerStack.scheduleFullInvalidation()`

New flow:
1. Consume `store.consumeApplyDocumentDiff()`
2. If present, process external-sync invalidation from the diff
3. Consume `store.consumeDirtyStateByLayer()`
4. Route local-action invalidation via existing `routeDirtyShapes(...)` path
5. Continue draft/hot-layer handling as today

#### New helper: `processApplyDocumentDiff(diff, layerStack, store)`

This function lives in the pipeline file (or a sibling helper file) and handles the diff-to-invalidation conversion:

```ts
function processApplyDocumentDiff(
  diff: ApplyDocumentDiff,
  layerStack: LayerStack & { scheduleFullInvalidation(): void },
  shapeHandlers: ShapeHandlerRegistry,
): void {
  if (diff.requiresFullInvalidation) {
    layerStack.scheduleFullInvalidation();
    return;
  }

  // Handle z-order full-layer invalidation
  // (defer to layerStack or handle per-layer)
  for (const layerId of diff.zOrderChangedLayers) {
    // Need a per-layer full invalidation method on layerStack
    // See "LayerStack changes" below
  }

  // Process added shapes
  for (const id of diff.added) {
    const shape = diff.nextDoc.shapes[id];
    if (!shape) continue;
    const bounds = tryGetShapeBounds(shape, shapeHandlers);
    if (!bounds) {
      // Escalate layer to full invalidation
      continue;
    }
    // Route bounds as dirty region on shape's layer
  }

  // Process removed shapes
  for (const id of diff.removed) {
    const shape = diff.prevDoc.shapes[id];
    if (!shape) continue;
    const bounds = tryGetShapeBounds(shape, shapeHandlers);
    if (!bounds) {
      // Escalate layer to full invalidation
      continue;
    }
    // Route bounds as dirty region on shape's previous layer
  }

  // Process changed shapes
  for (const id of diff.changed) {
    const prevShape = diff.prevDoc.shapes[id];
    const nextShape = diff.nextDoc.shapes[id];
    if (!prevShape || !nextShape) continue;

    const prevBounds = tryGetShapeBounds(prevShape, shapeHandlers);
    const nextBounds = tryGetShapeBounds(nextShape, shapeHandlers);

    if (!prevBounds || !nextBounds) {
      // Escalate affected layer(s) to full invalidation
      continue;
    }

    const prevLayerId = prevShape.layerId ?? "default";
    const nextLayerId = nextShape.layerId ?? "default";

    if (prevLayerId === nextLayerId) {
      // Same layer: invalidate union(prev, next) on that layer
    } else {
      // Cross-layer: invalidate prevBounds on old layer, nextBounds on new layer
    }
  }
}
```

The `tryGetShapeBounds` helper wraps `getShapeBounds` in a try/catch, returning `null` on failure. This keeps the bounds-failure → full-layer-invalidation escalation clean.

### `packages/renderer-raster/src/layerStack.ts`

#### Add to `LayerStack` interface and `LayerStackImpl`:

```ts
// On LayerStack interface:
routeDirtyRegions(regionsByLayer: Map<string, Box[]>): void;
scheduleFullLayerInvalidation(layerId: string): void;
```

**`routeDirtyRegions(regionsByLayer)`:**
For each `(layerId, boxes)` entry:
- look up the backend for `layerId`
- call a new `backend.routeDirtyRegions(boxes)` method
- call `this.enqueueBake()`

**`scheduleFullLayerInvalidation(layerId)`:**
- look up the backend for `layerId`
- call `backend.scheduleFullInvalidation()`
- call `this.enqueueBake()`

#### Add to `LayerBackend` interface:

```ts
routeDirtyRegions(regions: Box[]): void;
```

#### Add to `TileLayerBackend`:

```ts
routeDirtyRegions(regions: Box[]): void {
  for (const region of regions) {
    this.tileRenderer.markRegionDirty(region);
  }
}
```

#### Add to `CanvasLayerBackend`:

```ts
routeDirtyRegions(_regions: Box[]): void {
  // Canvas layers don't do region-level invalidation yet
  // Mark the whole canvas dirty
  this.dirty = true;
}
```

### `packages/renderer-raster/src/index.ts` (TileRenderer)

#### Add method: `markShapeRegionDirty(shapeId, prevBounds, nextBounds)`

Per-shape region invalidation that also updates `lastTilesByShape` to keep the shape-ID path's tile memory coherent. See `edge-case-lastTilesByShape-staleness.md` for why this is required.

```ts
markShapeRegionDirty(
  shapeId: string,
  prevBounds: Box | null,
  nextBounds: Box | null,
): void {
  if (prevBounds) {
    for (const tile of getVisibleTileCoords(prevBounds, this.tileSize)) {
      const key = tileKey(tile);
      this.pendingBakeTiles.add(key);
      this.snapshotStore.deleteSnapshot(this.snapshotKeyForCoordKey(key));
    }
  }
  if (nextBounds) {
    const tiles = getVisibleTileCoords(nextBounds, this.tileSize);
    const nextKeys = new Set(tiles.map(tileKey));
    for (const key of nextKeys) {
      this.pendingBakeTiles.add(key);
      this.snapshotStore.deleteSnapshot(this.snapshotKeyForCoordKey(key));
    }
    this.lastTilesByShape.set(shapeId, nextKeys);
  } else {
    this.lastTilesByShape.delete(shapeId);
  }
  this.touchedTilesByShape.delete(shapeId);
}
```

This method must be used instead of a shapeless `markRegionDirty` for diff-driven per-shape invalidation. Without updating `lastTilesByShape`, the next time the same shape is routed through the shape-ID path (e.g., a local move), `updateTouchedTilesForShape` would union with stale tile positions, missing the diff's position entirely.

### `packages/core/src/store/drawingStore.ts` -- remove dual-write

After the pipeline is updated to consume the diff, remove the shape-ID dirtying from `applyDocument()` and `resetToDocument()`. Specifically, delete the lines that write to `dirtyShapeIds`, `deletedShapeIds`, `dirtyShapeIdsByLayer`, `deletedShapeIdsByLayer` in both methods (the current lines 379-399 in `applyDocument` and the equivalent block in `resetToDocument`).

After this removal, the only code paths that write shape-ID dirty state are `trackDirtyState()` (called by `mutateDocument`, `undo`, `redo`) -- which is the intended final state.

### Diagnostic instrumentation

Add `logDiagnosticEvent` calls:

```ts
logDiagnosticEvent("pipeline_apply_diff_consumed", {
  added: diff.added.size,
  removed: diff.removed.size,
  changed: diff.changed.size,
  zOrderChangedLayers: diff.zOrderChangedLayers.size,
  requiresFullInvalidation: diff.requiresFullInvalidation,
  layerTopologyChanged: diff.layerTopologyChanged,
});
```

## Acceptance criteria

- `bun test` passes in `packages/core`, `packages/renderer-raster`, and `apps/splatterboard`
- `tsc --noEmit` passes in all three packages
- `bunx biome check --write` produces no errors in all three packages
- The app works correctly when a remote document sync arrives (manual verification):
  - remote move: only affected tiles rebake
  - remote delete: only affected tiles rebake
  - remote add: only affected tiles rebake
  - clear/reset: full invalidation still works
- Local drawing (pen strokes, selection, undo/redo) is unaffected -- still uses shape-ID dirty path
- `logDiagnosticEvent` fires for apply-diff consumption with correct counts
