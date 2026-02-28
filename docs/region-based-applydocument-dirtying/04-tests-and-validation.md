# Step 4: Integration Tests and Validation

## Scope

Add integration-level tests that validate the end-to-end dirty region flow, and add any remaining unit tests for the new renderer-side methods. This step also covers manual validation of the optimization under multiplayer traffic.

## Files to create or modify

### New file: `packages/renderer-raster/src/__tests__/tileRendererRegions.test.ts`

Tests for `TileRenderer.markShapeRegionDirty()`:

1. **markShapeRegionDirty schedules correct tiles for both prev and next bounds**
   - Set up a TileRenderer with a known viewport
   - Call `markShapeRegionDirty("s1", prevBox, nextBox)` where boxes span different tiles
   - `getPendingBakeTiles()` contains tiles for both regions

2. **markShapeRegionDirty updates lastTilesByShape to next bounds**
   - Call `markShapeRegionDirty("s1", prevBox, nextBox)`
   - Then call `updateTouchedTilesForShape(shape at new position)` followed by `scheduleBakeForShape("s1")`
   - Verify that `getPendingBakeTiles()` includes the next bounds tiles, not the stale prev bounds tiles

3. **markShapeRegionDirty with null nextBounds clears lastTilesByShape (delete case)**
   - Call `markShapeRegionDirty("s1", prevBox, null)`
   - `getPendingBakeTiles()` contains prev tiles
   - Subsequent `scheduleBakeForShape("s1")` does not reference stale tiles

4. **markShapeRegionDirty invalidates snapshot cache**
   - Set up snapshots in the store
   - Call `markShapeRegionDirty`
   - Snapshots for affected tiles are deleted

5. **remote move then local move cleans up all positions (the staleness edge case)**
   - Shape starts at P1, `lastTilesByShape` has P1's tiles
   - Call `markShapeRegionDirty("s1", P1_bounds, P2_bounds)` (simulating remote move)
   - Bake
   - Call `updateTouchedTilesForShape(shape at P3)` then `scheduleBakeForShape("s1")` (simulating local move)
   - Verify pending tiles include P2 AND P3, but not P1 (P2 from updated `lastTilesByShape`, P3 from current bounds)

### New file: `packages/core/src/__tests__/applyDocumentDiff.test.ts`

Integration tests that exercise the store's `applyDocument()` → `consumeApplyDocumentDiff()` flow end-to-end with realistic documents:

1. **remote move produces correct diff**
   - Create doc with shape at position A
   - Create nextDoc with same shape at position B (new object)
   - `applyDocument(nextDoc)`
   - diff has `changed = {shapeId}`, `added` and `removed` empty

2. **remote delete produces correct diff**
   - Create doc with two shapes
   - Create nextDoc with one shape removed
   - diff has `removed = {shapeId}`

3. **remote add produces correct diff**
   - Create doc with one shape
   - Create nextDoc with two shapes
   - diff has `added = {newShapeId}`

4. **remote cross-layer move produces correct diff**
   - Shape changes `layerId` between docs
   - diff has `changed = {shapeId}`
   - Pipeline can read both `prevDoc.shapes[id].layerId` and `nextDoc.shapes[id].layerId`

5. **remote z-order change produces correct diff**
   - Shape changes `zIndex` between docs
   - diff has `changed = {shapeId}` and `zOrderChangedLayers` contains the layer

6. **mixed frame: local mutation + remote apply**
   - `store.mutateDocument(...)` adds a local shape
   - `store.applyDocument(nextDoc)` applies a remote change
   - `consumeDirtyStateByLayer()` has the local shape
   - `consumeApplyDocumentDiff()` has the remote change
   - Both are independently correct

7. **two applyDocument calls before consume coalesce correctly**
   - `store.applyDocument(doc2)` then `store.applyDocument(doc3)`
   - diff has `prevDoc` pointing to original doc (not doc2)
   - diff captures all changes from original → doc3

8. **resetToDocument then applyDocument preserves full invalidation**
   - `store.resetToDocument(doc2)` then `store.applyDocument(doc3)`
   - diff has `requiresFullInvalidation = true`

## Manual validation checklist

After deploying steps 1-3, verify these scenarios in the running app with two browser tabs (or two devices) connected to the same document:

- [ ] Tab A draws a stroke → Tab B sees the stroke appear, only affected tiles rebake
- [ ] Tab A moves a shape → Tab B sees the move, old and new tile regions rebake
- [ ] Tab A deletes a shape → Tab B sees the deletion, old tile region clears
- [ ] Tab A clears the canvas → Tab B sees the clear, full invalidation fires
- [ ] Tab A creates a new document → Tab B resets correctly
- [ ] During all of the above, local drawing on Tab B is uninterrupted
- [ ] Check diagnostic logs (`globalThis.__smalldrawGetDiagnosticLog()`) for `pipeline_apply_diff_consumed` events with reasonable counts
- [ ] Check perf counters (`globalThis.__kidsDrawPerf`) for reduced tile bake counts during remote edits compared to before

## Acceptance criteria

- All new tests pass: `bun test` in `packages/core` and `packages/renderer-raster`
- All existing tests continue to pass: `mise run test:all`
- `mise run ts:check:all` passes
- `mise run lint:all` passes
- Manual multiplayer validation passes (checklist above)
