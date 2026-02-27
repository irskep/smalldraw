# Replace composition policy with first-class layers

## Context

The composition policy approach tried to solve layer-like problems (coloring page lineart between drawing and stickers) without first-class layers. Each fix created new edge cases: double-rendering lineart during drawing, sticker drafts appearing below lineart during placement, performance regressions from unconditional overlay re-rendering. The user decided to implement the full layer system from `docs/thinking/layers_design.md`, replacing composition policy entirely.

## Phase 1: Core data model

**`packages/core/src/model/document.ts`**

Add `DrawingLayer` type and `layers` field to `DrawingDocumentData`:

```typescript
export interface DrawingLayer {
  id: string;
  name?: string;
  zIndex: string;
  kind: "drawing" | "image";
  visible?: boolean;  // default true
  locked?: boolean;   // default false
  opacity?: number;   // default 1
  image?: { src: string };
}
```

Add `layers: Record<string, DrawingLayer>` to `DrawingDocumentData`.

Add `normalizeDocumentLayers(doc)` — if `layers` is missing/empty, inject a single `"default"` drawing layer. Call during `createDocument()`.

**`packages/core/src/model/shape.ts`**

`layerId` already exists as optional on `Shape`. Make it required (default `"default"` during normalization).

## Phase 2: Layer-aware ordering and z-index

**`packages/core/src/zindex.ts`**

Add:
- `getOrderedLayers(doc): DrawingLayer[]` — layers sorted by `layer.zIndex`
- `getShapesInLayer(doc, layerId): AnyShape[]` — shapes filtered and sorted by `shape.zIndex`
- `getTopZIndexInLayer(doc, layerId): string | null`

Keep existing `getOrderedShapes()` and `getTopZIndex()` unchanged (they still return all shapes globally sorted, which is needed for flat rendering).

**`packages/core/src/tools/runtime.ts`** — `ToolRuntimeImpl`

Add `getActiveLayerId()` that reads from a new field on `ToolRuntimeConfig`. Add `getNextZIndexInLayer(layerId)` that scopes z-index generation to shapes in that layer.

**`packages/core/src/tools/types.ts`** — `ToolRuntime` interface

Add `getActiveLayerId(): string` and `getNextZIndexInLayer(layerId?: string): string`.

**`packages/core/src/store/drawingStore.ts`** — `DrawingStore`

Add `activeLayerId: string` field (default `"default"`), `getActiveLayerId()`, `setActiveLayerId(layerId)`. Pass `activeLayerId` into `ToolRuntimeConfig`.

## Phase 3: Renderer — `renderLayerStack`

**`packages/renderer-canvas/src/document.ts`**

Add `renderLayerStack()` that replaces `renderCompositionPolicy()`:

```typescript
export function renderLayerStack(
  ctx: CanvasRenderingContext2D,
  layers: DrawingLayer[],    // already sorted by layer.zIndex
  shapes: Shape[],           // all shapes, will be partitioned by layerId
  options: RenderLayerStackOptions,
): void
```

Iterates layers in order. For `kind: "drawing"`, renders shapes with matching `layerId`. For `kind: "image"`, draws the resolved image. Reuses existing `renderOrderedShapes()` and `partitionShapesByLayer()` internals.

Keep `renderCompositionPolicy()` temporarily until all callers migrate, then delete.

## Phase 4: Multi-layer rendering pipeline

**`apps/splatterboard/src/render/createRasterPipeline.ts`**

The pipeline renders the layer stack. The current fixed structure stays similar but is driven by document layers instead of composition policy:

- Tile baker renders only the shapes whose `layerId` matches the base drawing layer (currently `"default"`, or `"color-under"` in coloring mode). This is determined by looking at document layers sorted by zIndex and taking the bottom-most drawing layer.
- The overlay canvas renders everything above the base drawing layer: image layers (lineart) + upper drawing layers (stickers) + their drafts.
- The session's `getDrafts` is filtered to only include drafts targeting the base drawing layer (same approach as the earlier plan, but now driven by layer data rather than hardcoded `"sticker"` strings).

Replace `setCompositionPolicy()` with `setLayers(layers: DrawingLayer[])` on the `RasterPipeline` interface.

Replace `getBaseSteps()`/`getOverlaySteps()` with layer-based equivalents that partition layers into "base" (bottom drawing layer, baked into tiles) and "overlay" (everything above).

Render sticker-layer drafts on the overlay canvas alongside committed overlay content.

**`apps/splatterboard/src/view/KidsDrawStage.ts`**

No structural DOM changes needed. The existing `tileLayer` / `hotCanvas` / `hotOverlayCanvas` / `overlay` stack maps cleanly to the layer system: tiles for base layer, hot for base drafts, overlay for upper layers + their drafts.

## Phase 5: Tool routing

**`apps/splatterboard/src/tools/stamps/letterStamp.ts`** and **`imageStamp.ts`**

Replace `resolveStampLayerId()` with `runtime.getActiveLayerId()`. The app sets the active layer based on document type + tool family, so stamps no longer need to inspect presentation themselves.

**`apps/splatterboard/src/tools/fillTool.ts`**

Replace `getCompositionPolicy()` + `renderCompositionPolicy()` with `getOrderedLayers()` + `renderLayerStack()`. Fill shape gets `layerId: runtime.getActiveLayerId()`.

**`apps/splatterboard/src/controller/createDocumentRuntimeController.ts`**

Replace `getCompositionPolicy()` call with reading `doc.layers` (via `getOrderedLayers()`). Pass ordered layers to `pipeline.setLayers()` instead of `pipeline.setCompositionPolicy()`.

Set `store.setActiveLayerId()` based on document type + active tool. Coloring mode: brush/fill → `"color-under"`, stamps → `"stickers-over"`. Normal mode: everything → `"default"`.

## Phase 6: Snapshot/export

**`apps/splatterboard/src/controller/createSnapshotService.ts`**

Replace `renderCompositionPolicy()` with `renderLayerStack()`. Get layers from document via `getOrderedLayers(doc)`.

## Phase 7: Cleanup

- Delete `packages/core/src/composition/compositionPolicy.ts`
- Remove `compositionPolicy` export from `packages/core/src/index.ts`
- Remove `renderCompositionPolicy` from `packages/renderer-canvas/src/document.ts` and its export
- Remove `CompositionPolicy` / `CompositionStep` types
- Delete `packages/core/src/composition/__tests__/compositionPolicy.test.ts`
- Update `packages/renderer-canvas/src/__tests__/renderCompositionPolicy.test.ts` → test `renderLayerStack` instead

## Document initialization for coloring mode

When a coloring document is created (presentation has `referenceImage` with `composite: "over-drawing"`), `createDocument()` or the app's document setup creates three layers:

```
{ id: "color-under",    kind: "drawing", zIndex: "a0" }
{ id: "lineart",        kind: "image",   zIndex: "a1", locked: true, image: { src: "/lineart.png" } }
{ id: "stickers-over",  kind: "drawing", zIndex: "a2" }
```

For markup mode (`composite: "under-drawing"`):

```
{ id: "background",     kind: "image",   zIndex: "a0", locked: true, image: { src: "/photo.png" } }
{ id: "default",        kind: "drawing", zIndex: "a1" }
{ id: "stickers-over",  kind: "drawing", zIndex: "a2" }
```

For normal mode:

```
{ id: "default", kind: "drawing", zIndex: "a0" }
```

This replaces the current `getCompositionPolicy()` derivation — layers are explicit document state.

## Verification

- `mise run ts:check:all` passes
- `mise run test:all` passes
- New unit tests for `getOrderedLayers()`, `getShapesInLayer()`, `getTopZIndexInLayer()`, document normalization
- Updated tests for `renderLayerStack()` replacing composition policy tests
- Manual: brush strokes appear below lineart in coloring mode
- Manual: sticker drafts appear above lineart during placement
- Manual: committed stickers above lineart at rest
- Manual: fill respects lineart boundaries in coloring mode
- Manual: normal mode drawing unchanged
- Manual: export/thumbnail matches on-screen rendering
