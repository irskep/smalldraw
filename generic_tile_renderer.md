# Generic Layer Renderer Plan

## Goal
Design a scalable rendering architecture where each document layer chooses a rendering strategy from a small, generic set:

- `tile`
- `canvas`

The pipeline should be driven by centralized layer configuration, not scattered `if/else` branches tied to specific layer names or modes.

## Core Principle
Keep layer semantics (`drawing` / `image`, visibility, lock, order) separate from rendering strategy (`tile` / `canvas`).

## Proposed Architecture

### 1. Layer Render Strategy in Data
Add or derive a strategy per layer:

- `renderStrategy: "tile" | "canvas"`

This may be persisted in `DrawingLayer` or resolved at runtime by policy.

### 2. Centralized Render Plan Resolver
Create one resolver that converts document state into a runtime render plan:

- `resolveLayerRenderPlan(doc): LayerRenderPlan[]`

Each plan item should include:

- `layerId`
- `kind` (`drawing` / `image`)
- `renderStrategy` (`tile` / `canvas`)
- `zIndex` (or already sorted order)
- optional image source / style controls

All layer-specific rendering behavior should be decided here.

### 3. Unified Backend Interface
Introduce a backend interface implemented by both strategies:

- `renderFrame(context)`
- `onDirtyShapes(shapeIds)`
- `onViewportChange(metrics)`
- `onRenderIdentityChange(identity)`
- `dispose()`

Implementations:

- `TileLayerRenderer`
- `CanvasLayerRenderer`

### 4. Layer Stack Orchestrator
Introduce a `LayerStackRenderer` that:

- owns backend instances keyed by `layerId`
- diffs old/new render plans
- creates/reconfigures/disposes backends
- routes dirty events to relevant backend only
- composites in plan order deterministically

### 5. Dirty Routing by Layer
Route invalidation by `shape.layerId` (and layer-level changes for image/style updates). Avoid global invalidations when only one layer changed.

## Incremental Implementation Plan

1. Add render-plan types and resolver (non-breaking scaffold).
2. Add backend interface and adapter wrappers around current paths.
3. Move current base tile path into `TileLayerRenderer`.
4. Move current overlay canvas path into `CanvasLayerRenderer`.
5. Switch pipeline orchestration to `LayerStackRenderer`.
6. Add layer-scoped dirty routing.
7. Enable strategy configuration changes via resolver only.
8. Profile and tune using layer-specific counters.

## Why This Scales

- Avoids per-frame/per-tile full-document scans for unrelated layers.
- Supports N layers without adding new conditional branches.
- Allows independent tuning per strategy.
- Keeps rendering policy centralized and testable.
- Future strategy additions (e.g. WebGL/offscreen) slot in without pipeline rewrite.

---

# Existing Scalability Risks (Current Code)

## 1. Base Tile Bake Scans All Shapes
In `createRasterPipeline`, base tile baking currently renders with:

- `renderLayerStack(..., [baseLayer], store.getOrderedShapes(), ...)`

This forces partition/filter work against all shapes for every baked tile, even when most shapes are on other layers.

### Impact
- Cost grows with total shape count, not base-layer shape count.
- Large sticker populations can slow base-layer edits.

### Mitigation
- Maintain per-layer ordered shape arrays and feed only the target layer into tile bake.

## 2. Overlay Invalidation Coupled to Global Ordered-Shape Identity
Overlay redraw is marked dirty when `store.getOrderedShapes()` reference changes.

### Impact
- Base-layer commits can trigger overlay redraw even when overlay content is unchanged.

### Mitigation
- Track overlay-layer revision/version only.
- Invalidate overlay only on overlay layer changes (or relevant image layer changes).

## 3. Overlay Redraw is Full-Canvas + Re-filter/Re-sort
Overlay path currently recomputes overlay shape list and redraws full overlay canvas when dirty.

### Impact
- Cost increases sharply with many overlay shapes.
- Committed sticker-heavy docs may stutter on frequent updates.

### Mitigation
- Move heavy overlay drawing layer(s) to `tile` strategy.
- Keep only truly static/simple layers on `canvas` strategy.

## 4. Overlay Draft Signature Under-Invalidates
Draft signature uses only `id:zIndex:layerId`.

### Impact
- Transform/style changes for existing draft IDs can skip redraw incorrectly.

### Mitigation
- Use robust revisioning for drafts (or explicit dirty events from tools).

## 5. `getRenderState()` Merge Cost at High Shape Counts
`RasterSession` still calls `store.getRenderState()` and merges document + drafts globally.

### Impact
- Adds avoidable overhead under large documents.

### Mitigation
- Add layer-scoped render-state selectors.
- Merge drafts only for active/affected backend.

## 6. Potential Tile Touch Over-Inclusion
Tile touch updates are shape-centric and may still schedule work broader than necessary when updates are frequent across layers.

### Mitigation
- Keep touched-tile maps per backend/layer.
- Schedule bake queues per backend.

---

# Observability Recommendations

Add per-layer metrics before and during migration:

- bake tiles count by layer
- bake ms by layer
- overlay redraw count/ms by layer/backend
- dirty-shape counts by layer
- full invalidations by reason

This keeps architectural decisions data-driven and helps validate regressions quickly.

---

# Design Guardrails

- No layer-name hardcoding in renderer internals.
- No strategy decision logic outside resolver/orchestrator.
- Backends should not know application modes (`normal`, `coloring`, `markup`).
- Layer behavior should be explainable via render plan alone.
