# Per-Layer Rendering Plan (v2)

## Problem

The overlay canvas path renders all non-base shapes to a single viewport-sized canvas. With thousands of stamps on a large screen, this is a full-canvas redraw on every mutation — cost scales with shape count × viewport area.

## Solution

Every drawing layer (mutable, interacts with user tools/eraser) gets its own TileRenderer. Static layers (images, future vectors) get a single viewport-sized canvas. The pipeline manages a flat list of layer containers in DOM z-order.

## Strategy Derivation

No new model fields. A pure function derives strategy from layer properties:

```
drawing layer → tile
image layer   → canvas
```

This lives in `renderer-raster` as a one-liner. If future layer kinds need different strategies, this function is the only place that changes.

## DOM Structure

Each layer gets a container `<div>` in z-order within the stage. All containers get `will-change: transform` for GPU compositor promotion (cheap z-reordering, no repaint cascades).

```
stage
├── layer-container[background]     canvas strategy: single <canvas>
├── layer-container[default]        tile strategy: N tile <canvas> elements
├── hot-canvas                      ← repositioned to active layer's z-slot
├── layer-container[stickers-over]  tile strategy: N tile <canvas> elements
└── (debug overlays etc.)
```

When the active layer changes, the hot canvas DOM element is moved to that layer's position in the stack. With GPU-promoted containers, this is a compositor-side operation.

### Tile layer container

Same as current tile approach: absolutely-positioned 1024×1024 canvases within a container div. One TileRenderer instance per tile-strategy layer, each with its own:
- tile provider (creates/destroys tile canvases in its container)
- touched-tile map
- pending bake queue
- snapshot store

### Canvas layer container

A single `<canvas>` element sized to viewport backing pixels. Redrawn when:
- viewport changes (pan/zoom) — re-renders visible portion with world-to-backing transform
- layer content changes (e.g. image source swap)
- visibility toggles

For image layers this is just a `drawImage` call with the viewport transform. No shape rendering, no dirty tracking.

## Hot Canvas and Drafts

Drafts always render in screen space using dirty rects — same as today. The key change is which tile renderer provides the backdrop snapshot.

**When drafting starts** on the active layer:
1. The active layer's tile container is hidden
2. Hot canvas is positioned at the active layer's z-slot
3. Backdrop snapshot is captured from the **active layer's TileRenderer only** (not all layers)
4. Hot canvas renders: backdrop + drafts, clipped to dirty bounds

**When drafting ends:**
1. Hot canvas is cleared, backdrop released
2. Active layer's tile container is shown
3. Dirty shapes are routed to the active layer's TileRenderer for baking

Other layers (tile or canvas) remain visible and untouched throughout. They're separate DOM elements at different z-positions — the browser composites them.

## Shape-to-Layer Routing

### Per-layer shape selectors (lazy, cached)

Add to DrawingStore:

```typescript
getOrderedShapesForLayer(layerId: string): AnyShape[]
```

Computed on first read after mutation, cached until next shape change. Each tile bake calls this instead of `getOrderedShapes()`, eliminating the all-shapes scan.

### Dirty shape routing

When shapes are committed, route to the correct TileRenderer by `shape.layerId`:

```typescript
for (const shape of dirtyShapes) {
  const layerId = shape.layerId ?? DEFAULT_LAYER_ID;
  const renderer = tileRenderers.get(layerId);
  renderer?.updateTouchedTilesForShape(shape);
  renderer?.scheduleBakeForShape(shape.id);
}
```

No global invalidation unless a layer-level change occurs (visibility, render identity).

## Pipeline Changes

### What moves to `renderer-raster`

The layer orchestration logic currently embedded in `createRasterPipeline` moves to a new function in `renderer-raster`:

```typescript
function createLayerStack(stage: HTMLElement, options: LayerStackOptions): LayerStack
```

This manages:
- creating/disposing layer containers and their renderers (tile or canvas)
- syncing layer list on `setLayers()` — diff old/new, create/dispose as needed
- DOM z-ordering of containers
- hot canvas positioning when active layer changes
- routing dirty shapes to the correct tile renderer
- viewport/DPI updates forwarded to all renderers

### What stays in the app

`createRasterPipeline` becomes thinner — it wires the LayerStack to the store, handles image loading, and connects the session's draft/commit lifecycle. App-specific concerns (image preloading, mode-specific behavior) stay here.

### RasterSession changes

- `captureBackdropSnapshot()` captures from the **active layer's** TileRenderer, not a global tile renderer
- `captureTouchedTiles()` routes by `shape.layerId`
- Bake queue remains singular (serialized across all layers) to avoid parallel bake contention

## Layer Sync Protocol

When `setLayers(newLayers)` is called:

1. Derive strategy for each layer
2. Diff against current layer set:
   - **Added layers**: create container + renderer (tile or canvas)
   - **Removed layers**: dispose renderer, remove container from DOM
   - **Reordered layers**: reorder containers in DOM
   - **Strategy unchanged**: no-op (strategy is derived from kind, which doesn't change)
3. Re-insert hot canvas at active layer's position

This is the only code path that creates or destroys renderers. No ad-hoc creation elsewhere.

## Implementation Steps

### Step 1: Per-layer shape selectors

Add `getOrderedShapesForLayer(layerId)` to DrawingStore. Lazy + cached. Wire existing tile bake to use it instead of `getOrderedShapes()`. This is a standalone perf improvement that ships independently.

### Step 2: createLayerStack in renderer-raster

Build the layer stack manager:
- Layer container creation/disposal with GPU promotion
- Per-layer TileRenderer instances
- Canvas-strategy layer rendering
- Hot canvas z-positioning
- Dirty shape routing
- Viewport/DPI forwarding

### Step 3: Migrate createRasterPipeline

Replace the current single-TileRenderer + overlay-canvas approach with createLayerStack. The pipeline becomes a thinner coordinator:
- Passes store state to layer stack
- Handles image loading for canvas-strategy layers
- Connects RasterSession's draft lifecycle to the active layer's tile renderer

### Step 4: Update RasterSession

- Backdrop snapshot from active layer's TileRenderer
- Dirty shape routing by layerId
- Remove overlay-specific rendering path (it's now just another tile layer)

## Scalability Risks Addressed

| Risk from v1 | How it's resolved |
|---|---|
| Tile bake scans all shapes | Per-layer shape selectors — each bake only sees its own shapes |
| Overlay invalidation coupled to global shape ref | Each tile renderer tracks its own dirty state independently |
| Overlay full-canvas redraw | Drawing overlays are now tile-rendered — incremental dirty-tile baking |
| Draft signature under-invalidation | Unchanged (orthogonal fix, not blocked by this work) |
| getRenderState() global merge cost | Per-layer shape selectors reduce merge scope per bake |
| Tile touch over-inclusion | Per-renderer touched-tile maps — already scoped by construction |

## Guardrails

- No layer-name hardcoding in renderer-raster. Strategy derived from layer kind only.
- No mode awareness (`normal`/`coloring`/`markup`) in rendering code.
- Renderers don't know about each other — the layer stack manages them uniformly.
- One code path creates renderers (`setLayers` diff). One code path routes dirty shapes (by `layerId`).
