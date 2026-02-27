# Lab Notebook: LayerStack first-load bug

## Symptoms
1. First page load: blurry coloring page image, NO committed shapes visible
2. Drawing doesn't stick — hot layer shows draft, then draft disappears on commit
3. Switching to another drawing and back fixes everything

## Observation 1: Store constructor doesn't mark shapes dirty

`DrawingStore` constructor just assigns `this.document`. `dirtyShapeIdsByLayer` stays as `new Map()` (empty).

But `resetToDocument()` (called on drawing switch) populates it:
```
this.dirtyShapeIds = new Set(Object.keys(nextDoc.shapes));
for (const shape of ...) this.addShapeToLayerDirtyBucket(...)
```

So on first load, the store has shapes but they're NOT dirty.

## Observation 2: bakeInitialShapes runs before setLayers

Timeline:
1. `createRasterPipeline()` → layerStack created, NO layers
2. `bakeInitialShapes(shapes)` → `layerStack.routeDirtyShapes()` → `layersById` is empty → no backend receives anything → routing lost
3. Later: `documentRuntimeController.start()` → `applyDocumentPresentation()` → `pipeline.setLayers()` → backends created
4. First RAF `renderInternal()` → `consumeDirtyStateByLayer()` → empty maps → nothing routed

## Observation 3: setLayers doesn't trigger enqueueBake

`setLayers()` creates backends with `dirty=true` (canvas) or needing initial bake (tile), but never calls `enqueueBake()`. Newly created backends just sit there.

## Observation 4: 120ms debounced scheduleResizeBake does full invalidation

`scheduleResizeBake()` fires ~120ms after init: `scheduleBakeForClear()` → `scheduleFullInvalidation()` → `enqueueBake()`. This bakes all visible tiles from scratch using `store.getOrderedShapesForLayer()` (reads live shapes). Should fix tiles. Also triggers `bakePending()` on canvas backends.

But if the coloring page image hasn't loaded by 120ms, the canvas backend's `redraw()` calls `resolveImage(src)` → returns null → draws nothing. `dirty` set to `false`.

## Observation 5: Image load callback doesn't invalidate canvas backend

`queueReferenceImageLoadWhenNeeded` loads the image async. On load (line 121 of createDocumentRuntimeController.ts), calls `requestRenderFromModel()`. This triggers `renderInternal()`, which calls `consumeDirtyStateByLayer()` → empty → routes nothing → no `enqueueBake()`. The canvas backend's `dirty` is `false` and it never redraws with the now-loaded image.

This explains the blurry image: the canvas is sized correctly (viewport × DPR) but its content is from a render where the image wasn't loaded yet, OR it's the default 300×150 canvas stretched by CSS.

## Observation 6: Why switching drawings fixes it

`switch_or_create_completed` intent handler does:
```
pipeline.scheduleBakeForClear()  // full invalidation
pipeline.bakePendingTiles()      // flush
requestRenderFromModel()
```
AND `resetToDocument()` marks all shapes dirty. So the next `renderInternal()` has dirty state, routes it, and the full invalidation bakes everything. By this time the image is already cached.

## Root causes (confirmed)

### Bug A: No mechanism to bake newly-created backends
`setLayers()` creates backends but doesn't trigger a bake. The backends sit idle until some external event triggers `enqueueBake()`.

### Bug B: Image load doesn't invalidate canvas backend
When the coloring page image finishes loading, `requestRenderFromModel()` runs `renderInternal()` which only routes store dirty state. There's no dirty state, so the canvas backend never redraws.

### Bug C: bakeInitialShapes runs before layers exist (minor)
Shapes are routed to empty layer map. Not the primary cause (the 120ms resize bake would compensate) but contributes to the overall fragility.

## Fix attempt 1 (FAILED — no behavior change)

### Applied:
1. `setLayers()` now calls `this.scheduleFullInvalidation()` when new backends are created
2. Image load callback now calls `pipeline.scheduleBakeForClear()` + `bakePendingTiles()`
3. Canvas mock in test setup expanded with missing methods

### Result: No behavior change. Bug persists.

### Why it failed:
My hypothesis that the 120ms debounced `scheduleResizeBake` would compensate was apparently correct — it WAS already doing a full invalidation. The problem is something else.

## Revised hypothesis

The `setLayers` fix added a full invalidation at layer creation time, but the debounced `scheduleResizeBake` was ALREADY doing a full invalidation 120ms later. If the bug persists, the full invalidation itself isn't working. Possible reasons:

### H1: TileRenderer has no visible tiles at bake time
`scheduleFullInvalidation()` → `tileRenderer.scheduleBakeForClear()` → sets `invalidateAll=true`. But `bakePendingTiles()` with `invalidateAll` iterates `this.visibleTiles`. If `visibleTiles` is empty (no viewport set, or viewport of 0), nothing bakes.

Need to check: does `updateViewport()` on TileRenderer actually create visible tiles? The backend's `updateViewport` calls `this.tileRenderer.updateViewport({ min: [0,0], max: [width, height] })`. But what if width/height are still 1 (the default)?

### H2: renderInternal consumes dirty state but bake is async, and something clears it
The bake promise chain runs asynchronously. Could a second `consumeDirtyStateByLayer()` call or `consumeDirtyState()` call clear state between the routing and the bake?

### H3: The render loop never calls render() at the right time
Maybe `requestRenderFromModel()` schedules a RAF, but the RAF never fires because the app isn't visible or something prevents it.

### H4: The pipeline's `render()` is never called on first load
What if the render loop isn't started yet when the first dirty state arrives?

## Experiment 1: Add console.log instrumentation

Added logs to setLayers, setRenderIdentity, updateViewport, scheduleFullInvalidation, bakePending (tile+canvas), renderInternal.

### Console output (fresh load):
```
updateViewport 1x1@1 → 1240x1754@2
setRenderIdentity "" → "kids-draw-init"
setLayers ['color-under', 'lineart', 'stickers-over'] createdNew: true
scheduleFullInvalidation ← setLayers
setRenderIdentity "kids-draw-init" → "kids-draw|w:1240|h:1754|tile:256|dpr:2.000|bg:#ffffff|presentation:normal"  ← updateRenderIdentity
  (bakes run — tiles baked, canvas baked without image)
  (more bakes — debounced resize)
scheduleFullInvalidation ← scheduleBakeForClear  (image load callback)
  (bakes run — canvas now has image ✓)
scheduleFullInvalidation ← scheduleBakeForClear  (debounced resize)
  (bakes run — all good)
setLayers ['color-under', 'lineart', 'stickers-over'] createdNew: false
setRenderIdentity "...presentation:normal" → "...presentation:over-drawing:/_bun/asset/3e108725eab0339e.png"
  ← updateRenderIdentity
(NO BAKE AFTER THIS)
```

### FOUND IT: The smoking gun

**The LAST two lines are the killer.** After everything renders correctly:
1. `setLayers` is called AGAIN (same layers, `createdNew: false`)
2. `setRenderIdentity` changes to include `presentation:over-drawing:...`

The identity change calls `tileRenderer.setRenderIdentity()` on every backend, which **releases all visible tiles and creates new empty ones**. And `setRenderIdentity` on CanvasLayerBackend just sets `dirty=true`.

**But nobody calls `enqueueBake()` after `setRenderIdentity()`!** The LayerStack's `setRenderIdentity` method just forwards to backends — it doesn't schedule a bake. So the tiles stay empty and the canvas stays dirty forever.

The second `setLayers` call has `createdNew: false` so it doesn't trigger `scheduleFullInvalidation()`.

### Root cause (REVISED)

`LayerStackImpl.setRenderIdentity()` destroys all tile content and marks canvas backends dirty, but never triggers a bake. Content is destroyed with no recovery path.

### Why switch-drawing works

On drawing switch, `switch_or_create_completed` explicitly calls `scheduleBakeForClear()` + `bakePendingTiles()` which forces a full invalidation and bake after the identity change.

### The secondary question

Why does the presentation change from `normal` to `over-drawing` AFTER initial load? This is a coloring page — it should have been `over-drawing` from the start. Looks like `applyDocumentPresentation` is called first with `normal`, then later updated to the correct presentation. The second call triggers the identity change that destroys everything.

## Fix attempt 2: setRenderIdentity triggers scheduleFullInvalidation

Added `this.scheduleFullInvalidation()` at the end of `setRenderIdentity()`. This ensures that after tiles are released and recreated empty by the identity change, a bake is immediately scheduled to repopulate them.

### Result: Bug appears fixed. Content renders and stays visible on fresh load. Need to verify with debug logging still in place, then run tests.

## Open items
- Remove debug logging after confirming fix
- Run `mise run ts:check:all` and `mise run test:all`
- Verify drawing sticks (draft commit → tile bake)
- Verify switch-drawing still works
- Consider whether the `normal` → `over-drawing` presentation double-apply is itself a bug worth fixing separately
