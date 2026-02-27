# Per-Layer Rendering Plan (v3)

## Objective
Build a scalable layer renderer where each layer uses one of two strategies:

- `tile`
- `canvas`

No mode-specific logic in renderer internals. No layer-name branching in rendering code. All strategy decisions are centralized.

---

## 1. Design Rules

1. Strategy is derived centrally from `DrawingLayer`.
2. Rendering orchestration lives in `renderer-raster`, not app code.
3. Dirty routing is layer-scoped; avoid global shape scans during interaction.
4. Draft/hot-canvas compositing obeys explicit z-order invariants.
5. Per-layer observability is built in from the start.

---

## 2. Strategy Derivation

Do not add persistent strategy fields to the document model.

Use a pure resolver in `renderer-raster`:

```ts
resolveLayerStrategy(layer: DrawingLayer): "tile" | "canvas"
```

Initial policy:
- `kind === "drawing"` -> `tile`
- `kind === "image"` -> `canvas`

This function is the only place strategy policy changes.

---

## 3. LayerStack API (No Intermediate Plan Type)

`LayerStack` consumes `DrawingLayer[]` directly.

```ts
interface LayerStack {
  setLayers(layers: DrawingLayer[]): void;
  setActiveLayer(layerId: string): void;
  updateViewport(width: number, height: number, dpr: number): void;
  setRenderIdentity(identity: string): void;

  routeDirtyShapes(dirtyShapeIds: Iterable<string>, deletedShapeIds: Iterable<string>): void;

  // Draft orchestration support only (not draft painting):
  beginActiveLayerDraftSession(): Promise<void>; // hide active tile container + capture active backdrop
  endActiveLayerDraftSession(): void;            // show active tile container + release backdrop
  getActiveLayerBackdropSnapshot(): CanvasImageSource | null;

  dispose(): void;
}
```

Notes:
- LayerStack does not own draft rendering.
- `HotLayer` remains the draft painter.
- `RasterSession` remains the interaction-lifecycle coordinator.

---

## 4. Ownership Split

### `renderer-raster` owns
- `createLayerStack(...)`
- layer diffing, backend lifecycle, DOM ordering
- per-layer backends (`tile`/`canvas`)
- active-layer hot-canvas z-slot placement
- dirty routing to specific backends

### app (`createRasterPipeline`) owns
- wiring store/session events to LayerStack
- image loading/caching concerns
- app-specific policies

---

## 5. Backends

### 5.1 Tile backend (`TileLayerBackend`)
One `TileRenderer` per tile-strategy layer.

Each instance has independent:
- tile provider + container
- touched-tiles map
- bake queue state
- snapshot store

Tile bake input must come from `getOrderedShapesForLayer(layerId)` only.

### 5.2 Canvas backend (`CanvasLayerBackend`)
Single viewport-sized canvas in its own container.

Redraw triggers:
- viewport/DPR change
- layer content/visibility change
- render identity change

For image layers: `drawImage` with world-to-backing transform.

---

## 6. Store API Changes (Required)

Current global `getRenderState()` is too broad for layer-scaled rendering.

Add:

```ts
getOrderedShapesForLayer(layerId: string): AnyShape[];

consumeDirtyStateByLayer(): {
  dirtyByLayer: Map<string, Set<string>>;
  deletedByLayer: Map<string, Set<string>>;
};
```

Rules:
- Lazy + cached per-layer ordered arrays.
- Cache invalidation on add/delete/z-index/layerId changes.
- Dirty IDs bucketed by layer at mutation time.
- `consumeDirtyStateByLayer()` is **consume-once** (read-and-clear). A second call in the same frame returns empty unless new mutations occurred.
- Document this contract at API definition and add a unit test to prevent misuse regressions.

This avoids global shape merges/scans on each render loop.

---

## 7. Draft & Backdrop Invariants (Critical)

When drafting on active layer `L`:

1. Non-active layer containers remain visible.
2. Active layer tile container is hidden.
3. Hot canvas is inserted at `L`'s exact z-slot.
4. Backdrop snapshot source is active layer `L` only.
5. HotLayer renders: active-layer backdrop + active-layer drafts.

When draft ends:

1. HotLayer is cleared; backdrop released.
2. Active layer tile container is shown.
3. Commit dirty IDs route only to active layer backend.

Guarantee: visual result equals “full layer composition with active layer replaced by active draft frame”.

---

## 8. Layer Sync Protocol

On `setLayers(nextLayers)`:

1. Sort by `zIndex`.
2. For each layer, derive strategy via `resolveLayerStrategy(layer)`.
3. Diff current vs next by `layer.id`:
   - added: create container + backend
   - removed: dispose backend + remove container
   - existing: update visibility/content as needed
4. Reorder containers in DOM to match z-order.
5. Reinsert hot canvas at active-layer slot.

This is the only renderer creation/disposal path.

---

## 9. Performance Routing Rules

Dirty routing:
- use `consumeDirtyStateByLayer()`
- call only touched backend(s)

Tile bake:
- backend calls `getOrderedShapesForLayer(layerId)`
- no all-shapes filter/partition per tile

Full invalidation only for:
- render identity change
- explicit clear-all semantics
- structural layer changes requiring rebuild

---

## 10. Observability (Timing + Scope)

Add metrics plumbing in Step 1, then populate as each backend/orchestrator piece lands.

Required counters/timings:
- `layer.<id>.bake.tiles`
- `layer.<id>.bake.ms`
- `layer.<id>.snapshot.ms`
- `layer.<id>.dirty.count`
- `layer.<id>.fullInvalidations`
- `hot.render.ms`
- `hot.backdrop.ms`

Add totals + p95 interaction frame timing.

---

## 11. Implementation Steps

### Step 1: Store + Metrics Plumbing
- Add `getOrderedShapesForLayer(layerId)`.
- Add `consumeDirtyStateByLayer()`.
- Add baseline per-layer metric scaffolding.

### Step 2: Build LayerStack Deliverable (single integrated step)
In `renderer-raster`, implement together:
- strategy resolver
- tile/canvas backends
- layer diffing + DOM ordering
- active-layer hot-slot behavior
- dirty routing

(These parts are interdependent and should ship/test together.)

### Step 3: Migrate `createRasterPipeline`
- Replace single-tile+overlay orchestration with LayerStack.
- Keep `HotLayer`/`RasterSession` as draft renderer/lifecycle owner.
- Use LayerStack only for draft backdrop + layer visibility/z-slot orchestration.

### Step 4: RasterSession Integration
- Backdrop snapshot from active layer backend.
- Dirty routing by layer buckets.
- Remove obsolete overlay path as part of this migration (not a separate cleanup phase).
- Note: Steps 3 and 4 are tightly coupled and may ship as one implementation unit/PR.

### Step 5: Validation + Stress Pass
- Functional matrix checks.
- High-stamp-count profiling.
- Verify per-layer metrics align with expected routing.

---

## 12. Validation Matrix

Functional:
- base drawing under image layer renders correctly
- sticker drawing above image renders correctly
- draft on active layer appears at correct z-slot
- export/snapshot matches on-screen composition

Performance:
- base-layer edits with many sticker shapes do not scale with total shape count
- sticker-layer edits only bake sticker backend tiles
- no full-canvas overlay redraw loop under heavy stamp counts

Stability:
- no renderer leaks when layers are added/removed/reordered
- no stale hot-canvas placement after active-layer switches
- no stale/backdrop races on rapid layer switching during draft start/end

---

## Appendix: Critical Review Prompts

### A. Correctness and Visual Equivalence
1. Does hot-canvas z-slot insertion always match full compositing order?
2. Are begin/end draft transitions race-free under rapid active-layer changes?
3. Are visibility toggles reflected atomically across backends?

### B. Dirty-State and Cache Semantics
1. Does `consumeDirtyStateByLayer()` cover add/delete/z-index/layerId/clear paths?
2. Do per-layer ordered-shape caches invalidate exactly when needed?
3. Are deleted-shape invalidations sufficient when previous touched tiles are stale?

### C. Performance Under Load
1. With 10k stamps on non-active layers, do active-layer edits avoid total-shape scans?
2. Does per-layer orchestration introduce measurable overhead vs prior baseline?
3. Is global bake serialization acceptable, or does it bottleneck realistic workflows?

### D. Boundary Discipline
1. Is all strategy logic confined to resolver/orchestrator?
2. Does app code remain thin and renderer-agnostic?
3. Is LayerStack lifecycle/disposal explicitly test-covered?

### E. Test Adequacy
1. Are mid-draft active-layer switch and layer reorder/removal tested?
2. Are high-shape-count scenarios included with timing assertions/thresholds?
3. Are compositing invariants verified via snapshots or pixel tests?
