# Edge Case: `lastTilesByShape` staleness after diff-path invalidation

## The scenario

A remote sync moves a shape via the diff path. Then, before or after the bake, a local action moves the same shape via the shape-ID path. The shape-ID path uses `lastTilesByShape` to know which tiles to clean up from the shape's previous position -- but the diff path's `markRegionDirty()` bypasses `lastTilesByShape` entirely, leaving it stale.

## Setup

Assume tile size is 1024. Shape `rect-1` is a 100x100 rectangle.

- **Frame N**: shape `rect-1` is rendered at position `(100, 100)`. It occupies tile `(0,0)`. After bake, `lastTilesByShape.get("rect-1")` = `{"0,0"}`.

## Step-by-step

### 1. Remote sync moves `rect-1` to `(1200, 100)`

`store.applyDocument(nextDoc)` produces a diff:
- `changed = {"rect-1"}`
- `prevDoc.shapes["rect-1"]` has translation `(100, 100)` → prevBounds on tile `(0,0)`
- `nextDoc.shapes["rect-1"]` has translation `(1200, 100)` → nextBounds on tile `(1,0)`

### 2. Pipeline consumes the diff

The pipeline calls `processApplyDocumentDiff(diff, ...)`:
- Computes `prevBounds` for `rect-1` → tile `(0,0)`
- Computes `nextBounds` for `rect-1` → tile `(1,0)`
- Calls `tileRenderer.markRegionDirty(prevBounds)` → adds `"0,0"` to `pendingBakeTiles`
- Calls `tileRenderer.markRegionDirty(nextBounds)` → adds `"1,0"` to `pendingBakeTiles`

**Critically**: `markRegionDirty()` does NOT update `lastTilesByShape` or `touchedTilesByShape`. Those maps still say:
- `lastTilesByShape.get("rect-1")` = `{"0,0"}` (from frame N)

### 3. Bake runs

Tiles `(0,0)` and `(1,0)` are rebaked. The baker renders all shapes on each tile from the current document:
- Tile `(0,0)`: no rect-1 here anymore (correct, cleared)
- Tile `(1,0)`: rect-1 at (1200, 100) rendered (correct)

Visual state is now correct. But `lastTilesByShape.get("rect-1")` is still `{"0,0"}`.

### 4. Local user moves `rect-1` to `(2300, 100)`

`store.mutateDocument(new UpdateShapeTransform("rect-1", { translation: [2300, 100] }))` fires `trackDirtyState`, adding `"rect-1"` to `dirtyShapeIdsByLayer`.

### 5. Pipeline consumes shape-ID dirty state

No diff this time (local action). Pipeline calls `layerStack.routeDirtyShapes({"rect-1"}, {})`.

`TileLayerBackend.routeDirty()` calls `tileRenderer.updateTouchedTilesForShape(rect-1)`:

```
shape rect-1 is at (2300, 100) → current bounds on tile (2,0)
nextKeys = {"2,0"}
previous = lastTilesByShape.get("rect-1") = {"0,0"}  ← STALE!
touched = {"0,0"} ∪ {"2,0"} = {"0,0", "2,0"}
lastTilesByShape.set("rect-1", {"2,0"})
```

Then `scheduleBakeForShape("rect-1")` bakes tiles `{"0,0", "2,0"}`.

### 6. Bake runs

- Tile `(0,0)`: rebaked, shows no rect-1 (correct, but wasted work -- it was already clean)
- Tile `(2,0)`: rebaked, shows rect-1 at (2300, 100) (correct)
- **Tile `(1,0)`: NOT rebaked!** Still shows rect-1 at (1200, 100) from step 3's bake.

### Result

**Stale pixels at tile `(1,0)`.** The shape was rendered there by the diff path's bake, but neither the diff path nor the subsequent shape-ID path cleaned it up. The diff path didn't update `lastTilesByShape`, so the shape-ID path didn't know tile `(1,0)` needed cleanup.

## Why this happens

`TileRenderer` has two tile-tracking systems that need to stay in sync:

1. **`pendingBakeTiles`**: the set of tile keys to rebake on the next bake cycle. Both `markRegionDirty()` and `scheduleBakeForShape()` write to this.

2. **`lastTilesByShape`**: per-shape memory of which tiles the shape most recently occupied. Only `updateTouchedTilesForShape()` writes to this. `markRegionDirty()` bypasses it.

The diff path correctly invalidates tiles for the current frame by writing to `pendingBakeTiles`. But it leaves `lastTilesByShape` stale, which means the next time the shape goes through the shape-ID path, the "old position cleanup" logic unions with the wrong tiles.

## Fix

The diff path must update `lastTilesByShape` for each shape it processes.

### Option A: update `lastTilesByShape` from the pipeline

After processing a shape through the diff, compute the shape's current tile set and update `lastTilesByShape`:

```ts
// For each shape in diff.changed or diff.added:
const nextShape = diff.nextDoc.shapes[id];
const nextBounds = tryGetShapeBounds(nextShape, shapeHandlers);
if (nextBounds) {
  const tiles = getVisibleTileCoords(nextBounds, tileSize);
  tileRenderer.setLastTilesForShape(id, new Set(tiles.map(tileKey)));
}

// For each shape in diff.removed:
tileRenderer.clearLastTilesForShape(id);
```

This requires exposing two new methods on `TileRenderer`:

```ts
setLastTilesForShape(shapeId: string, tiles: Set<string>): void {
  this.lastTilesByShape.set(shapeId, tiles);
}

clearLastTilesForShape(shapeId: string): void {
  this.lastTilesByShape.delete(shapeId);
}
```

### Option B: route diff shapes through `updateTouchedTilesForShape` as well

Instead of `markRegionDirty`, have the diff path call `updateTouchedTilesForShape` with prevDoc shapes for old bounds and nextDoc shapes for new bounds. But this is awkward because `updateTouchedTilesForShape` takes a single shape and computes only current bounds -- it uses `lastTilesByShape` for old bounds, which is exactly the thing that's wrong.

### Option C: a combined method

Add a method that does both: invalidates a region AND updates `lastTilesByShape`:

```ts
markShapeRegionDirty(shapeId: string, prevBounds: Box | null, nextBounds: Box | null): void {
  if (prevBounds) {
    const tiles = getVisibleTileCoords(prevBounds, this.tileSize);
    for (const tile of tiles) {
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
    // Shape was deleted
    this.lastTilesByShape.delete(shapeId);
  }
  // Clear any pending touched state for this shape
  this.touchedTilesByShape.delete(shapeId);
}
```

## Recommended fix

**Option C** is the cleanest. It gives the diff path a single method that correctly handles both tile invalidation and `lastTilesByShape` bookkeeping. The method signature makes the intent clear: "this shape moved from prevBounds to nextBounds, handle both tile invalidation and tracking."

This means `markRegionDirty(bounds: Box)` (the shapeless version proposed in step 3) should be replaced with `markShapeRegionDirty(shapeId, prevBounds, nextBounds)` for shape-level diff invalidation. The shapeless `markRegionDirty` can still exist for non-shape regions (like z-order full-layer invalidation via scheduleFullInvalidation), but shape-level diff processing should use the shape-aware variant.

## Impact on step 3

The pipeline integration doc (`03-pipeline-integration.md`) proposes `markRegionDirty(bounds)` as the tile renderer method. That should be revised to use `markShapeRegionDirty(shapeId, prevBounds, nextBounds)` for per-shape invalidation from the diff, so that `lastTilesByShape` stays coherent with the shape-ID path.

## Test case

This edge case should be added to the test list in `04-tests-and-validation.md`:

- **remote move followed by local move of the same shape**: verify that tiles at the remote position are cleaned up when the local move's bake runs. Specifically, `lastTilesByShape` after the diff-path bake must reflect the diff's next position, not the pre-diff position.
