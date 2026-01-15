# Lab Notebook: Selection Preview and Rendering Artifact Fixes

## Date: 2026-01-15

## Problem Statement

Two bugs were identified in the smalldraw vanilla JS demo:

1. **Shapes don't render during selection drag** - When moving/scaling/rotating a selected shape, the shape would not preview its new position until the operation completed.

2. **Rendering artifacts** - When dragging out rectangles or moving shapes, visual trails/ghosts were left behind on the canvas.

---

## Bug 1: Selection Preview During Drag

### Root Cause Analysis

The selection tool (`packages/core/src/tools/selection.ts`) tracked drag operations internally but only updated a `selectionFrame` (the dashed selection rectangle) during `pointerMove`. The actual shape transforms were only applied on `pointerUp` via `applyDrag()`.

The renderer (`buildLiveDocument()` in `createVanillaDrawingApp.ts`) merged drafts with document shapes, but the selection tool never emitted preview drafts during drag.

### Solution

**Extended the draft system to support multiple drafts:**

1. Added `setDrafts(shapes: DraftShape[])` method to `ToolRuntime` interface (`packages/core/src/tools/types.ts:47-48`)

2. Updated `ToolRuntimeImpl` (`packages/core/src/tools/runtime.ts`):
   - Changed internal storage from single draft to array: `private drafts: DraftShape[] = []`
   - Changed callback signature: `onDraftChange?: (drafts: DraftShape[]) => void`
   - Added `setDrafts()` implementation with validation

3. Updated `DrawingStore` (`packages/core/src/store/drawingStore.ts`):
   - Changed `runtimeDrafts` from `Map<string, DraftShape | null>` to `Map<string, DraftShape[]>`
   - Updated `getDrafts()` to flatten: `return Array.from(this.runtimeDrafts.values()).flat()`

**Added preview shape computation in selection tool:**

Created `computePreviewShapes()` function that mirrors the `applyDrag()` logic but returns `DraftShape[]` instead of committing actions. Handles:
- Move: translates shapes by drag delta
- Resize: uses resize adapters to compute new geometry and transforms
- Rotate: applies rotation delta to rotatable shapes

Updated event handlers:
- `onPointerMove`: calls `runtime.setDrafts(computePreviewShapes(runtime, state.drag))`
- `onPointerUp`: calls `runtime.clearDraft()` before applying final transforms
- `onPointerCancel`: calls `runtime.clearDraft()` to clean up

### Key Code Locations

- `packages/core/src/tools/types.ts:47-48` - New `setDrafts` interface method
- `packages/core/src/tools/runtime.ts:109-118` - `setDrafts` implementation
- `packages/core/src/tools/selection.ts:627-720` - `computePreviewShapes()` function
- `packages/core/src/tools/selection.ts:230` - Preview emission in `onPointerMove`

---

## Bug 2: Rendering Artifacts

### Root Cause Analysis

The renderer (`packages/renderer-konva/src/document.ts`) used manual canvas operations for the background:

```typescript
layer.clearBeforeDraw(false);
layer.on('beforeDraw.smalldraw-background', () => {
  const ctx = layer.getCanvas().getContext();
  ctx.clearRect(0, 0, stage.width(), stage.height());
  ctx.fillRect(0, 0, stage.width(), stage.height());
});
```

This approach disabled Konva's automatic clearing and manually cleared in `beforeDraw`. However, when shapes moved positions, Konva's dirty-rect optimization didn't know about old positions, leaving artifacts.

### Solution

Replaced manual canvas operations with an idiomatic Konva approach using a `Konva.Rect` for the background:

```typescript
function fillBackground(layer: Layer, options?: RenderDocumentOptions): void {
  const stage = layer.getStage();
  if (!stage) return;
  const color = options?.backgroundColor ?? options?.viewport?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
  const bgRect = new Konva.Rect({
    x: 0,
    y: 0,
    width: stage.width(),
    height: stage.height(),
    fill: color,
    listening: false,
  });
  layer.add(bgRect);
  bgRect.moveToBottom();
}
```

Also updated shape z-index to start at 1 (instead of 0) to keep shapes above the background rect:

```typescript
let zIndex = 1; // Start at 1 to keep shapes above background rect
```

### Key Code Locations

- `packages/renderer-konva/src/document.ts:68-82` - New `fillBackground()` implementation
- `packages/renderer-konva/src/document.ts:46` - z-index starting at 1

---

## Additional Fix: setPointerCapture Error

During testing, discovered that `setPointerCapture` throws when called with invalid pointer IDs (e.g., from synthetic events). Fixed by wrapping in try-catch:

```typescript
try {
  overlay.setPointerCapture?.(event.pointerId ?? 0);
} catch {
  // Pointer capture can fail with synthetic events or if pointer was released
}
```

### Key Code Locations

- `packages/ui-vanillajs/src/createVanillaDrawingApp.ts:342-346` - setPointerCapture fix
- `packages/ui-vanillajs/src/createVanillaDrawingApp.ts:365-369` - releasePointerCapture fix

---

## Testing

Manual testing performed via Playwright MCP:
1. Drew rectangles and verified rendering
2. Selected shapes and performed drag operations
3. Verified preview shapes appear during drag
4. Verified no artifacts remain after operations

Note: Renderer snapshot tests will need updating due to background rect change affecting rendered output.

---

## Files Modified

### packages/core
- `src/tools/types.ts` - Added `setDrafts` to ToolRuntime interface
- `src/tools/runtime.ts` - Implemented multi-draft support
- `src/tools/selection.ts` - Added preview shape computation and emission
- `src/store/drawingStore.ts` - Updated draft storage to support arrays

### packages/renderer-konva
- `src/document.ts` - Changed background rendering to use Konva.Rect

### packages/ui-vanillajs
- `src/createVanillaDrawingApp.ts` - Fixed setPointerCapture error handling
