# Step 1: `diffDocumentShapes` Pure Function

## Scope

Add the `ApplyDocumentDiff` type and the `diffDocumentShapes()` pure function to `packages/core`. This step has no side effects on existing behavior -- it adds new code with tests only.

## Files to create or modify

### New file: `packages/core/src/store/diffDocumentShapes.ts`

Contains:

```ts
import type { DrawingDocument } from "../model/document";

export interface ApplyDocumentDiff {
  prevDoc: DrawingDocument;
  nextDoc: DrawingDocument;
  added: Set<string>;
  removed: Set<string>;
  changed: Set<string>;
  zOrderChangedLayers: Set<string>;
  layerTopologyChanged: boolean;
  requiresFullInvalidation: boolean;
}

/**
 * Compute a structural diff between two document snapshots.
 *
 * Change detection uses reference equality (prevDoc.shapes[id] !== nextDoc.shapes[id]).
 * Callers must not mutate shape objects in place and then pass both snapshots.
 */
export function diffDocumentShapes(
  prevDoc: DrawingDocument,
  nextDoc: DrawingDocument,
): Omit<ApplyDocumentDiff, "prevDoc" | "nextDoc"> { ... }
```

Implementation logic:

1. Iterate `prevDoc.shapes` keys:
   - if key absent in `nextDoc.shapes` → add to `removed`
   - if key present in `nextDoc.shapes` and `prevDoc.shapes[id] !== nextDoc.shapes[id]` → add to `changed`
2. Iterate `nextDoc.shapes` keys:
   - if key absent in `prevDoc.shapes` → add to `added`
3. For each ID in `changed`:
   - compare `prevDoc.shapes[id].zIndex` vs `nextDoc.shapes[id].zIndex`
   - if different, add `prevDoc.shapes[id].layerId ?? "default"` and `nextDoc.shapes[id].layerId ?? "default"` to `zOrderChangedLayers`
4. Compute referenced layer ID sets from both docs' shapes. If the sets differ, set `layerTopologyChanged = true`.
5. Set `requiresFullInvalidation = layerTopologyChanged`.

### Modify: `packages/core/src/index.ts`

Add export:

```ts
export * from "./store/diffDocumentShapes";
```

### New file: `packages/core/src/__tests__/diffDocumentShapes.test.ts`

Tests (using `bun:test`, following existing patterns from `dirtyTracking.test.ts`):

1. **no changes** -- identical prev/next (same object references) → all sets empty, `layerTopologyChanged = false`, `requiresFullInvalidation = false`
2. **shape added** -- new ID in nextDoc → in `added`
3. **shape removed** -- ID absent in nextDoc → in `removed`
4. **shape changed (reference inequality)** -- same ID, different object → in `changed`
5. **shape unchanged (reference equality)** -- same ID, same object reference → not in any set
6. **z-order change detected** -- changed shape with different `zIndex` → layer added to `zOrderChangedLayers`
7. **z-order same on changed shape** -- changed shape with same `zIndex` → `zOrderChangedLayers` empty
8. **layer topology changed: new layer introduced** -- added shape with a `layerId` not referenced in prevDoc → `layerTopologyChanged = true`
9. **layer topology changed: last shape on layer removed** -- removed shape was the only shape on its layer → `layerTopologyChanged = true`
10. **layer topology unchanged** -- shapes change but all referenced layers stay the same → `layerTopologyChanged = false`
11. **cross-layer z-order change** -- changed shape with different `zIndex` and different `layerId` → both layers in `zOrderChangedLayers`

Test shapes can be minimal object literals with `{ id, type, zIndex, layerId, geometry, style }`. Use Automerge `init`/`change` to create real `DrawingDocument` values, following the `createDocument` pattern.

## Acceptance criteria

- `bun test` in `packages/core` passes with all new tests green
- `bunx biome check --write` in `packages/core` produces no errors
- `tsc --noEmit` in `packages/core` passes
- No existing tests break
- No existing behavior changes
