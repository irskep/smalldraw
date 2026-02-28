# Region-Based Dirtying For `applyDocument()`

## Summary

`DrawingStore.applyDocument()` currently over-invalidates by marking every surviving shape dirty whenever an external document snapshot is applied. This is correct, but wasteful under multiplayer traffic because a small remote change can trigger broad downstream tile invalidation and rebake work.

This design replaces that behavior with a structural diff for external document replacement, then computes invalidation regions in renderer-owned code using the previous and next document snapshots.

The design keeps responsibilities separated:

- `DrawingStore` owns document replacement and shape-level diff metadata
- renderer-side code owns bounds computation and invalidation routing

It also keeps existing local action dirty tracking intact:

- local actions (`mutateDocument`, `undo`, `redo`) continue to use shape-ID dirtying
- external document replacement (`applyDocument`) uses a dedicated diff payload instead of shape-ID dirtying

## Problem

### Current `applyDocument()` behavior

`DrawingStore.applyDocument()` in [`packages/core/src/store/drawingStore.ts:373`](/Users/steve/dev/apps/smalldraw/packages/core/src/store/drawingStore.ts#L373) currently:

1. replaces `this.document`
2. clears ordered caches
3. marks every shape in the next document as dirty
4. marks removed IDs as deleted
5. triggers render

The key lines are:

- [`packages/core/src/store/drawingStore.ts:379`](/Users/steve/dev/apps/smalldraw/packages/core/src/store/drawingStore.ts#L379): `this.dirtyShapeIds = new Set(Object.keys(nextDoc.shapes));`
- [`packages/core/src/store/drawingStore.ts:383`](/Users/steve/dev/apps/smalldraw/packages/core/src/store/drawingStore.ts#L383): every surviving shape is added to dirty buckets

That means one remote shape move can dirty the entire synchronized document.

### How this expands into tile work

The raster pipeline consumes dirty shape IDs in [`apps/splatterboard/src/render/createRasterPipeline.ts:156`](/Users/steve/dev/apps/smalldraw/apps/splatterboard/src/render/createRasterPipeline.ts#L156), flattens them, and calls `layerStack.routeDirtyShapes(...)`.

For tile-backed layers, that eventually leads to `TileRenderer.updateTouchedTilesForShape(...)` in [`packages/renderer-raster/src/index.ts:179`](/Users/steve/dev/apps/smalldraw/packages/renderer-raster/src/index.ts#L179), which computes shape bounds and touched tiles for each dirty shape.

So the current external-sync path is:

1. `applyDocument()` dirties all shapes
2. pipeline routes all dirty shape IDs
3. tile renderer recomputes bounds for all dirty shapes
4. many unaffected tiles may be reconsidered

This is the path to optimize.

## Goals

- Preserve correctness first
- Reduce over-invalidation from external document sync
- Keep `DrawingStore` simple and maintainable
- Avoid moving rendering-specific state into the store
- Avoid extra hot-path work during local drawing

## Non-Goals

- Replacing the local action dirtying path used by `mutateDocument()`
- Reworking hot-layer preview rendering
- Implementing minimal z-order invalidation in the first pass
- Implementing fine-grained canvas-layer partial redraw in the first pass

## Proposed Design

## 1. `applyDocument()` writes a diff, not shape-ID dirty state

For external document replacement, `applyDocument()` should stop writing to:

- `dirtyShapeIds`
- `deletedShapeIds`
- `dirtyShapeIdsByLayer`
- `deletedShapeIdsByLayer`

Instead, it should compute and store a consume-once diff artifact describing how the shape set changed between the effective previous snapshot and the latest next snapshot.

This is a replacement for the current `applyDocument()` shape-ID dirtying behavior, not an additional parallel dirty path for the same change source.

### Diff artifact

```ts
interface ApplyDocumentDiff {
  prevDoc: DrawingDocument;
  nextDoc: DrawingDocument;
  added: Set<string>;
  removed: Set<string>;
  changed: Set<string>;
  zOrderChangedLayers: Set<string>;
  layerTopologyChanged: boolean;
  requiresFullInvalidation: boolean;
}
```

Notes:

- `zOrderChangedLayers` is per-layer, not global, to avoid invalidating unrelated layers
- `prevDoc` and `nextDoc` are retained until the next render consumes the diff
- this retains a full-document reference for one frame, which is acceptable initially

## 2. `diffDocumentShapes(prevDoc, nextDoc)` is a pure function

The shape diff should be implemented as a standalone pure helper, not embedded as complex inline logic inside `applyDocument()`.

Suggested shape:

```ts
function diffDocumentShapes(
  prevDoc: DrawingDocument,
  nextDoc: DrawingDocument,
): Omit<ApplyDocumentDiff, "prevDoc" | "nextDoc">
```

Benefits:

- easy to test in isolation
- keeps `applyDocument()` as a thin orchestrator
- makes the change-detection contract explicit

## 3. Shape change detection uses reference equality

Initial change detection policy:

- for shape IDs present in both docs, a shape is considered changed when:
  - `prevDoc.shapes[id] !== nextDoc.shapes[id]`

This assumes shapes are replaced rather than mutated in place.

That invariant should be documented explicitly in the diff helper:

- callers must not mutate shape objects in place and then pass both snapshots through `applyDocument()`

This is a reasonable assumption for the current adapter subscription path, where snapshots cross a serialization boundary before reaching `applyDocument()`.

## 4. Z-order change detection is based on `zIndex` field changes of changed shapes

Initial z-order detection policy:

- for each shape ID in `changed`, compare `prevDoc.shapes[id].zIndex` and `nextDoc.shapes[id].zIndex`
- if they differ, add the relevant layer(s) to `zOrderChangedLayers`

This is intentionally narrower than recomputing the full ordered sequence per layer.

Why this is sufficient for the first pass:

- adds and deletes already produce region invalidation on their affected layers
- the initial design is not trying to detect all indirect ordering consequences from unrelated shape IDs
- explicit `zIndex` field change on a changed shape is the main reorder signal that needs conservative escalation

If this later proves insufficient, it can be replaced with full layer ordering comparison.

## 5. Layer topology change detection is based on effective layer-set changes

Initial `layerTopologyChanged` policy:

- compute the set of layer IDs referenced by shapes in `prevDoc`
- compute the set of layer IDs referenced by shapes in `nextDoc`
- if those sets differ, set `layerTopologyChanged = true`

This intentionally treats:

- a newly introduced layer ID
- disappearance of the last shape on a layer

as topology changes.

If explicit document-level layer metadata later becomes the authoritative source, this check can move to that structure instead.

## 6. Multiple `applyDocument()` calls before one render must coalesce correctly

This is the main correctness-sensitive rule.

If a pending unconsumed diff already exists and another `applyDocument()` arrives before the next render, the new diff must be computed against the original unconsumed `prevDoc`, not the current `this.document`.

Correct rule:

```ts
const effectivePrev = this.pendingApplyDocumentDiff?.prevDoc ?? this.document;
```

Then:

1. replace `this.document` with the latest `nextDoc`
2. compute `diffDocumentShapes(effectivePrev, nextDoc)`
3. store a new pending diff whose `prevDoc = effectivePrev` and `nextDoc = nextDoc`

Why this is required:

- if `doc1 -> doc2` and then `doc2 -> doc3` both arrive before one render, the renderer must invalidate for the effective change `doc1 -> doc3`
- computing only `doc2 -> doc3` loses invalidation for changes introduced in `doc1 -> doc2`

### Full invalidation must also accumulate

If the pending diff already has `requiresFullInvalidation = true`, any replacement diff before consumption must also preserve `requiresFullInvalidation = true`.

This applies to flows such as:

- `resetToDocument()` sets full invalidation
- another `applyDocument()` arrives before the render

The full invalidation signal must not be dropped.

## 7. Renderer computes bounds from the actual snapshots

Bounds computation should happen in renderer-owned code, using:

- `prevDoc.shapes[id]` for previous bounds
- `nextDoc.shapes[id]` for next bounds

This avoids:

- a store-owned bounds cache
- cache coherence bugs across local optimistic apply, undo/redo, and remote sync
- pushing rendering policy into `DrawingStore`

## 8. Pipeline consumes both external diffs and local shape-ID dirtying

These two change sources are not mutually exclusive in a frame.

Example:

1. local `mutateDocument()` runs and writes shape-ID dirty state
2. before the next RAF, a remote adapter update arrives and `applyDocument()` writes an external diff
3. the next render must process both

Therefore, the render pipeline should consume:

1. `consumeApplyDocumentDiff()`
2. `consumeDirtyStateByLayer()`

in the same render pass, not choose one “instead of” the other.

Why this is correct:

- shape-ID dirty state represents local action-based changes
- the diff represents external document replacement
- they are different sources and can coexist before the next render

## API Changes

## Store API

Add a dedicated consume-once API for external document replacement:

```ts
consumeApplyDocumentDiff(): ApplyDocumentDiff | null
```

Rules:

- `applyDocument()` sets the diff
- `resetToDocument()` may set a diff with `requiresFullInvalidation = true`
- local action paths continue using existing shape-ID dirty tracking

`applyDocument()` should no longer populate the shape-ID dirty fields once this diff path exists.

## Pipeline integration

In [`apps/splatterboard/src/render/createRasterPipeline.ts:156`](/Users/steve/dev/apps/smalldraw/apps/splatterboard/src/render/createRasterPipeline.ts#L156), the render flow should be:

1. consume `ApplyDocumentDiff`
2. if present, compute and route external-sync invalidation
3. consume existing shape-ID dirty state
4. route local-action invalidation
5. continue draft/hot-layer handling as today

This keeps routing decisions in the pipeline, which already owns backend coordination.

## Invalidation Rules

## Shape add

For `id in added`:

- compute `nextBounds` from `nextDoc.shapes[id]`
- invalidate `nextBounds` on the shape’s next layer

## Shape delete

For `id in removed`:

- compute `prevBounds` from `prevDoc.shapes[id]`
- invalidate `prevBounds` on the shape’s previous layer

## Shape changed on same layer

For `id in changed` where layer did not change:

- compute `prevBounds`
- compute `nextBounds`
- invalidate both old and new coverage

The initial implementation may represent that as:

- `union(prevBounds, nextBounds)` as one invalidation region

or:

- a two-box list

Both are correct as long as both old and new footprints are covered.

## Shape changed across layers

For `id in changed` where `prevDoc.shapes[id].layerId !== nextDoc.shapes[id].layerId`:

- invalidate `prevBounds` on the previous layer
- invalidate `nextBounds` on the new layer

This requires reading `layerId` from both snapshots during pipeline processing.

The diff itself does not need a special `changedCrossLayer` set initially, as long as the pipeline inspects both docs.

## Z-order changes

The first implementation should use an explicit conservative fallback:

- if a layer is in `zOrderChangedLayers`, perform full-layer invalidation for that layer

This is safer than trying to derive minimal regions for occlusion/reveal changes in the first pass.

## Full invalidation triggers

Set `requiresFullInvalidation = true` for:

- clear-like changes
- layer topology changes
- reset/open/create flows that replace the effective world
- malformed diff state

Additionally, the pipeline should escalate a layer to full invalidation if:

- bounds computation fails for any changed shape on that layer

## Region Representation

Do not collapse to one merged `Box` per layer by default.

Initial recommendation:

- keep a per-layer list of invalidation boxes
- allow a generous cap (for example `16` or `32`)
- if the cap is exceeded:
  - merge nearby boxes, or
  - escalate that layer to full invalidation

Why:

- one merged box quickly loses precision for sparse edits in distant parts of the canvas
- a modest list size is cheap compared with unnecessary full-layer rebakes

## Control Flow Examples

## Example A: remote move on the same layer

Assume:

- rectangle `rect-1` moves on layer `default`
- no z-order change
- no other shapes change

Flow:

1. Adapter subscription receives a new snapshot in [`apps/splatterboard/src/controller/createDocumentSessionController.ts:108`](/Users/steve/dev/apps/smalldraw/apps/splatterboard/src/controller/createDocumentSessionController.ts#L108).
2. `store.applyDocument(nextDoc)` computes:
   - `changed = {"rect-1"}`
   - `zOrderChangedLayers = {}`
   - `requiresFullInvalidation = false`
3. `applyDocument()` stores the diff and does **not** write shape-ID dirty state.
4. On the next render, the pipeline consumes the diff.
5. The pipeline reads:
   - `prevShape = prevDoc.shapes["rect-1"]`
   - `nextShape = nextDoc.shapes["rect-1"]`
6. The pipeline computes:
   - `prevBounds`
   - `nextBounds`
7. The pipeline invalidates both footprints (via union or two boxes).
8. Tile-backed routing converts only those regions into touched tiles.
9. The pipeline also consumes any local shape-ID dirty state that was already pending from separate local actions in the same frame.

Why this is correct:

- all changed pixels are inside the old or new rectangle footprint
- no unaffected shape is dirtied solely because a remote snapshot arrived

## Example B: two remote snapshots before one render

Assume:

- first snapshot applies `doc1 -> doc2`
- second snapshot applies `doc2 -> doc3`
- no render occurs between them

Correct flow:

1. First `applyDocument(doc2)`:
   - `effectivePrev = doc1`
   - pending diff becomes `(doc1, doc2)`
   - `this.document = doc2`
2. Second `applyDocument(doc3)` before render:
   - `effectivePrev = pendingDiff.prevDoc = doc1`
   - recompute diff as `(doc1, doc3)`
   - replace pending diff with `(doc1, doc3)`
   - `this.document = doc3`
3. The next render consumes only `(doc1, doc3)`

Why this is correct:

- the renderer only needs the effective invalidation from the last consumed snapshot to the latest snapshot
- no intermediate invalidation is lost

## Example C: remote delete

Assume `pen-7` exists in `prevDoc` and is absent in `nextDoc`.

Flow:

1. `applyDocument()` produces:
   - `removed = {"pen-7"}`
2. The pipeline consumes the diff.
3. The pipeline reads `prevDoc.shapes["pen-7"]`.
4. It computes `prevBounds`.
5. It invalidates `prevBounds` on the shape’s previous layer.

Why this is correct:

- the only changed pixels are where the deleted stroke used to be

## Example D: remote cross-layer move

Assume `stamp-2` moves from layer `foreground` to layer `background` and also changes position.

Flow:

1. `applyDocument()` marks `stamp-2` as changed.
2. The pipeline consumes the diff.
3. It reads:
   - `prevDoc.shapes["stamp-2"].layerId`
   - `nextDoc.shapes["stamp-2"].layerId`
4. It computes:
   - `prevBounds`
   - `nextBounds`
5. It invalidates:
   - `prevBounds` on `foreground`
   - `nextBounds` on `background`

Why this is correct:

- the old layer must clear the stale pixels
- the new layer must draw the moved content

## Example E: remote z-order change

Assume two overlapping shapes swap relative z-order on layer `default`.

Flow:

1. `applyDocument()` detects a `zIndex` field change on a changed shape and adds `default` to `zOrderChangedLayers`.
2. The pipeline consumes the diff.
3. The pipeline performs full invalidation for layer `default`.

Why this is correct:

- z-order changes can expose or occlude neighboring pixels outside one shape’s isolated geometry reasoning
- full-layer invalidation is conservative and correct

## Correctness Invariants

The design is correct if these invariants hold.

## 1. Old and new footprints must both be invalidated

For any geometry, transform, or style change that can affect raster output:

- invalidate the previous footprint
- invalidate the next footprint

Invalidating only the next footprint is wrong for moves, shrinks, and deletes.

## 2. Deleted shapes must be interpreted from `prevDoc`

Deletes have no next shape.

If `prevDoc` cannot be inspected for the removed shape, the pipeline must escalate to full invalidation of the affected layer.

## 3. Cross-layer changes require both layer assignments

The pipeline must read both:

- `prevDoc.shapes[id].layerId`
- `nextDoc.shapes[id].layerId`

to route invalidation correctly for moved shapes.

## 4. Shape objects must be treated as immutable snapshots

Change detection assumes:

- changed shapes are replaced, not mutated in place

If that invariant is violated, reference-equality diffing can miss changes.

## 5. Pending external diffs must accumulate before consumption

If multiple `applyDocument()` calls occur before one render:

- the stored pending diff must represent the effective change from the oldest unconsumed `prevDoc` to the newest `nextDoc`

Any design that overwrites `(doc1, doc2)` with `(doc2, doc3)` before render is incorrect.

## 6. Conservative fallback beats incorrect precision

Whenever the pipeline cannot prove a small invalidation safely, it should escalate:

- full-layer invalidation for layer-scoped uncertainty
- full invalidation for document-scoped uncertainty

## Edge Cases

## Bounds computation failure

If computing bounds throws or returns no usable result for a changed shape:

- escalate that layer to full invalidation

Do not mix partial invalidation with incomplete geometry information.

## Layer topology changes

Initial policy:

- compare the set of referenced layer IDs between `prevDoc` and `nextDoc`
- if the set differs, set `layerTopologyChanged = true`
- perform full invalidation

This is conservative and can be refined later.

Known over-invalidation:

- the first shape added to a previously unused layer ID
- the last shape removed from a previously referenced layer ID

will trigger `layerTopologyChanged = true` and therefore full invalidation, even when ordinary add/delete region invalidation would have been sufficient.

This is intentional in the first implementation because the rule is simple and correct. It should be treated as a conservative policy to revisit later, not as a minimal invalidation guarantee.

## Large documents

The diff temporarily retains references to `prevDoc` and `nextDoc` until the next render consumes it.

This increases transient memory retention by roughly one frame of document lifetime. That is acceptable initially, but should be noted when evaluating very large documents with many large pen strokes.

If this becomes an issue later, the diff can be narrowed to only changed shape records instead of whole-document references.

## Diff scan cost

`diffDocumentShapes` must scan the shape IDs in both `prevDoc` and `nextDoc`.

That means:

- cost scales with total document size, not only change size

This is likely acceptable, but the implementation should instrument:

- number of shapes scanned
- number of changed shapes found

so the ratio is observable under real multiplayer traffic.

## Performance Expectations

Expected improvements:

- remote small edits no longer dirty every shape
- tile invalidation becomes proportional to changed areas
- local stroke hot paths remain unchanged

New costs:

- `applyDocument()` performs shape-ID diffing
- the pipeline computes bounds for changed shapes during render

This is intentionally placed on the render side rather than inside the synchronous store update path.

The likely tradeoff is favorable:

- computing bounds for a small changed subset should be cheaper than the current full-document downstream invalidation path

This should still be validated with multiplayer traffic and large-pen-stroke documents.

## Rollout Plan

1. Add a pure `diffDocumentShapes(prevDoc, nextDoc)` helper with dedicated tests.
2. Change `applyDocument()` to:
   - compute the diff against `pendingDiff.prevDoc ?? this.document`
   - store it as a consume-once payload
   - preserve `requiresFullInvalidation` if a pending diff already requires it
   - stop writing shape-ID dirty state for this path
3. Add `consumeApplyDocumentDiff()`.
4. Update the raster pipeline to:
   - consume the diff
   - process external invalidation from the diff
   - also consume and process existing local shape-ID dirty state in the same render pass
5. Implement renderer-side bounds computation from `prevDoc` and `nextDoc`.
6. Add explicit full-layer fallback for `zOrderChangedLayers`.
7. Add tests for:
   - remote move
   - remote delete
   - remote cross-layer move
   - z-order change
   - bounds failure fallback
   - mixed-frame case where local shape-ID dirty state and external diff are both pending
   - multiple `applyDocument()` calls before one render
   - `resetToDocument()` setting `requiresFullInvalidation = true`, followed by `applyDocument()` before one render, to verify the full-invalidation flag is preserved during coalescing

## Why This Design

This design improves the most expensive external-sync invalidation path while keeping the system understandable:

- no store-owned bounds cache
- no permanent generic dual dirty-state abstraction
- explicit mixed-frame processing semantics
- explicit multi-apply accumulation semantics
- explicit conservative fallback rules

The result should be a multiplayer-friendly `applyDocument()` path that is cheaper than full-document dirtying without sacrificing correctness.
