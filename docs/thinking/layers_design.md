# Layers Design (Core + Splatterboard)

## Goal
Add true Photoshop-style layer stacks to core so we can support mixed raster/vector workflows cleanly:

- layers have their own z-order
- shapes are ordered within their layer
- tools target active layers instead of hardcoding `"default"`
- coloring mode can use separate under/over drawing layers with a lineart image layer in between

## Design Motivation

### Product/UX motivation

- Coloring mode needs semantically distinct drawing surfaces:
  - paint under lineart
  - place stickers above lineart
- Tool behavior should map to these surfaces directly, not through fragile render hacks.
- As more tool modes are added (multi-color, crazy modes, etc.), layer targeting must stay predictable.

### Technical motivation

- Current state mixes document semantics (coloring vs normal) with renderer-specific overlay behavior.
- `Shape.layerId` exists but has no effect on ordering/runtime, so it cannot enforce intent.
- Global `getNextZIndex()` makes cross-feature changes risky when two logical surfaces coexist.
- Snapshot/export correctness currently depends on special-case reference-image handling.

### Architectural motivation

- We want one source of truth for composition: the document model.
- Layers should be first-class document entities, not inferred from arbitrary shape fields.
- Rendering, fills, exports, and tool routing should all consume the same layer stack contract.

## Current State (Why Change)

- `Shape.layerId` exists but is not used for ordering/runtime policy.
- Global ordering is shape-only (`shape.zIndex`), independent of layer.
- `ToolRuntime.getNextZIndex()` is global, not per-layer.
- Splatterboard tools mostly hardcode `layerId: "default"`.
- Coloring page lineart is currently an overlay path, not a first-class layer.

## Alternatives Considered / Rejected

### 1. Keep global shape ordering only (`shape.zIndex`), no layer model

Idea:

- Encode layer intent via z-index conventions only.
- Keep document model unchanged.

Why rejected:

- No explicit layer entities means no place to store visibility/lock/opacity/name.
- Tool code must coordinate z-index domains manually; easy to regress.
- Queries like "all shapes on sticker layer" become heuristic rather than authoritative.
- Raster/image layers are awkward because there is no first-class non-shape slot in ordering.

### 2. Keep `shape.layerId` tags but no `layers` collection

Idea:

- Use `shape.layerId` and derive layer behavior dynamically from shape usage.

Why rejected:

- Layer z-order cannot be authored cleanly without layer objects.
- Empty layers cannot exist (important for UI/workflow parity with layer-based apps).
- No canonical location for layer properties (`visible`, `locked`, `opacity`, etc.).
- Image layers still need special out-of-band machinery.

### 3. App-only pseudo-layers (Splatterboard orchestration only)

Idea:

- Keep core unchanged; maintain multiple app-managed render streams/stores.

Why rejected:

- Duplicates composition logic across runtime, renderer, export, and snapshot paths.
- Increases divergence risk between on-screen render and exported output.
- Makes generic core tooling less useful for future apps that need true layering.

### 4. Continue with reference-image overlay as a permanent special case

Idea:

- Keep coloring lineart in separate overlay canvas and route tool behavior around it.

Why rejected:

- Fill and hit/composition behaviors become special-case heavy.
- Hard to extend to multiple raster layers or user-managed stacks.
- Violates desired design direction: state/composition in data model, not ad hoc render glue.

## Proposed Data Model

### Document
Extend `DrawingDocumentData` with a layer map:

- `layers: Record<string, DrawingLayer>`

Layer shape:

- `id: string`
- `name?: string`
- `zIndex: string`
- `kind: "drawing" | "image"`
- `visible?: boolean` (default `true`)
- `locked?: boolean` (default `false`)
- `opacity?: number` (default `1`)
- `blendMode?: string` (phase 1 can ignore at render time)
- `image?: { src: string; fit?: "stretch" | "contain" | "cover" }` for `kind: "image"`

Rules:

- every shape must reference an existing `layerId`
- default/migrated documents get one drawing layer: `"default"`
- old docs with missing `layers` are normalized on load

## Ordering Model

Render order becomes two-level:

1. layers sorted by `layer.zIndex`
2. within each visible drawing layer, shapes sorted by `shape.zIndex`
3. image layers render as raster slots between drawing layers

This keeps `zIndex` semantics intact while making layering explicit and predictable.

## Core API Changes

### Z-index helpers
Add per-layer helpers:

- `getOrderedLayers(doc)`
- `getOrderedShapesInLayer(doc, layerId)`
- `getTopShapeZIndexInLayer(doc, layerId)`
- keep existing helpers as compatibility wrappers for `"default"` during migration

### ToolRuntime
Add layer-aware APIs:

- `getActiveLayerId(): string`
- `setActiveLayerId(layerId: string): void`
- `getNextZIndexInLayer(layerId?: string): string`

Keep `getNextZIndex()` temporarily as alias to current active layer, then remove once app code migrates.

### DrawingStore
Store tracks active layer:

- `activeLayerId: string`
- validates layer existence on set
- tool runtime references store’s active layer

## Splatterboard Layer Plan

### Coloring document default stack

- `color-under` (`kind: "drawing"`)
- `lineart` (`kind: "image"`, locked)
- `stickers-over` (`kind: "drawing"`)

### Normal document default stack

- `default` (`kind: "drawing"`)

### Tool routing policy

In coloring mode:

- brush/fill/boxed/line -> `color-under`
- stamps/stickers -> `stickers-over`
- eraser -> start with active-layer erase; optional future mode for multi-layer erase

In normal mode:

- all tools -> `default`

This policy should be centralized in one resolver:

- input: `presentation.mode`, active tool id/family
- output: target layer id

## Renderer Integration

Phase 1:

- keep existing shape renderer stack
- build ordered render list from layer stack
- render image layers via image cache in the sequence
- render drawing-layer shapes via existing renderers

Phase 2 (optional):

- apply per-layer opacity/blend mode
- optimize tile baking per-layer invalidation

## Fill Tool Changes

Current fill samples a flattened shape canvas. In coloring mode we need intentional composition:

- source for flood-fill mask should include:
  - lineart image layer
  - relevant drawing layers that should block fill
- fill commit should target active drawing layer only

Initial policy:

- lineart blocks fill
- stickers-over does **not** block under-layer fills

## Snapshot / Export

Use the same layer stack ordering for:

- thumbnail generation
- png export

This eliminates current overlay-specific branches and keeps output consistent with canvas rendering.

## Clear / Undo Semantics

Recommended initial semantics:

- clear action clears shapes in editable drawing layers (not locked image layers)
- undo/redo remains action-based with no special-case changes

Follow-up option:

- scoped clear (active layer only)

## Migration Strategy

1. Add core layer types + document normalization (default layer injection).
2. Add layer-aware ordering and runtime APIs.
3. Keep compatibility aliases temporarily (`getNextZIndex` -> active layer).
4. Update splatterboard tools to stop hardcoding `"default"` and rely on runtime active layer.
5. Introduce coloring stack + tool->layer resolver.
6. Switch renderer/export/snapshot to layer-stack traversal.
7. Remove compatibility aliases after tests pass and callers are migrated.

## Test Matrix

Core:

- document with missing `layers` normalizes to default layer
- ordered layers by z-index
- ordered shapes within each layer by z-index
- runtime `getNextZIndexInLayer` independent across layers

Splatterboard:

- coloring mode brush writes to `color-under`
- coloring mode stamp writes to `stickers-over`
- lineart stays visible between under/over content
- fill in coloring mode respects lineart boundaries
- export/thumbnail match on-screen layer ordering
- clear does not remove lineart image layer

Regression:

- normal mode behavior unchanged
- undo/redo stable across mixed layer operations
- tile bake remains correct after layer-targeted edits

## Open Decisions

1. Eraser default in coloring mode:
   - active layer only, or cross-drawing-layers?
2. Clear default:
   - all editable layers, or active layer only?
3. Should lineart be a true core `image` layer now, or app-side synthetic layer first?

Recommendation for first implementation:

- eraser: active layer only
- clear: all editable drawing layers
- lineart: true core `image` layer now (avoids parallel rendering paths)
