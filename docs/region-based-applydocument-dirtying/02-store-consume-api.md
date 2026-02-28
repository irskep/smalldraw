# Step 2: Store Diff Storage and Consume API

## Scope

Add `pendingApplyDocumentDiff` field and `consumeApplyDocumentDiff()` method to `DrawingStore`. Modify `applyDocument()` to write a diff **in addition to** the existing shape-ID dirty state (temporarily). Modify `resetToDocument()` similarly.

This step adds the new diff API without removing the old shape-ID dirtying yet. Both are written, so existing pipeline consumers continue to work. Step 3 will update the pipeline to consume the diff and stop relying on shape-ID state from `applyDocument()`. After step 3 lands, a follow-up removes the shape-ID writes from `applyDocument()`/`resetToDocument()` (see step 3 for that cleanup).

This staging avoids a window where remote syncs produce no visible dirty state.

## Files to modify

### `packages/core/src/store/drawingStore.ts`

#### Add field

```ts
private pendingApplyDocumentDiff: ApplyDocumentDiff | null = null;
```

Add import for `ApplyDocumentDiff` and `diffDocumentShapes` from `./diffDocumentShapes`.

#### Add method: `consumeApplyDocumentDiff()`

```ts
consumeApplyDocumentDiff(): ApplyDocumentDiff | null {
  const diff = this.pendingApplyDocumentDiff;
  this.pendingApplyDocumentDiff = null;
  return diff;
}
```

#### Modify: `applyDocument(nextDoc)`

Current behavior (lines 373-403): replaces document, marks all shapes dirty via `dirtyShapeIds` and `dirtyShapeIdsByLayer`, marks removed shapes as deleted.

New behavior:

```ts
applyDocument(nextDoc: DrawingDocument): void {
  // Coalesce: if a pending diff exists, diff against its prevDoc
  const effectivePrev = this.pendingApplyDocumentDiff?.prevDoc ?? this.document;
  const prevRequiresFullInvalidation =
    this.pendingApplyDocumentDiff?.requiresFullInvalidation ?? false;

  this.document = nextDoc;
  this.syncActiveLayerId();
  this.orderedCache = null;
  this.orderedCacheByLayer.clear();

  const diffResult = diffDocumentShapes(effectivePrev, nextDoc);

  this.pendingApplyDocumentDiff = {
    prevDoc: effectivePrev,
    nextDoc,
    ...diffResult,
    requiresFullInvalidation:
      prevRequiresFullInvalidation || diffResult.requiresFullInvalidation,
  };

  this.rebuildShapeLayerIndex();
  this.onDocumentChanged?.(this.document);
  this.triggerRender();
}
```

Key changes from current:
- **Temporarily keeps** writing to `dirtyShapeIds`, `deletedShapeIds`, `dirtyShapeIdsByLayer`, `deletedShapeIdsByLayer` (existing code stays for now)
- Additionally computes and stores the diff
- Computes diff against `effectivePrev` for coalescing
- Preserves `requiresFullInvalidation` from any pending unconsumed diff

The existing shape-ID dirtying lines (379-399) remain in place during this step. They will be removed in step 3 after the pipeline is updated to consume the diff.

#### Modify: `resetToDocument(nextDoc)`

Current behavior (lines 405-444): same as applyDocument plus clears undo/selection/drafts.

New behavior: same structural changes as applyDocument, but always set `requiresFullInvalidation = true` on the diff. Keep the existing undo/selection/draft clearing logic.

```ts
resetToDocument(nextDoc: DrawingDocument): void {
  const effectivePrev = this.pendingApplyDocumentDiff?.prevDoc ?? this.document;

  this.document = nextDoc;
  this.syncActiveLayerId();
  this.undoManager.clear();
  this.orderedCache = null;
  this.orderedCacheByLayer.clear();

  const diffResult = diffDocumentShapes(effectivePrev, nextDoc);

  this.pendingApplyDocumentDiff = {
    prevDoc: effectivePrev,
    nextDoc,
    ...diffResult,
    requiresFullInvalidation: true, // always full for reset
  };

  this.rebuildShapeLayerIndex();
  this.selectionState.ids.clear();
  this.selectionState.primaryId = undefined;
  this.handles = [];
  this.handleHover = { handleId: null, behavior: null };
  this.selectionFrame = null;
  for (const runtime of this.runtimes.values()) {
    runtime.clearDraft();
    runtime.setPreview(null);
  }
  this.onDocumentChanged?.(this.document);
  this.triggerRender();
}
```

### `packages/core/src/__tests__/diffDocumentShapes.test.ts` (or new test file)

Add integration tests for the store-level behavior. Can go in existing `dirtyTracking.test.ts` or a new file.

Tests:

1. **applyDocument produces a diff, not shape-ID dirty state**
   - Call `store.applyDocument(nextDoc)` where nextDoc has one changed shape
   - `store.consumeDirtyStateByLayer()` returns empty maps
   - `store.consumeApplyDocumentDiff()` returns a diff with `changed` containing the shape ID

2. **consumeApplyDocumentDiff is consume-once**
   - Call `store.applyDocument(nextDoc)`
   - First `consumeApplyDocumentDiff()` returns a diff
   - Second `consumeApplyDocumentDiff()` returns `null`

3. **multiple applyDocument calls coalesce**
   - `store.applyDocument(doc2)` then `store.applyDocument(doc3)` before consuming
   - `consumeApplyDocumentDiff()` returns diff with `prevDoc === doc1` (original) and `nextDoc === doc3`

4. **resetToDocument sets requiresFullInvalidation**
   - `store.resetToDocument(nextDoc)`
   - `consumeApplyDocumentDiff()?.requiresFullInvalidation` is `true`

5. **resetToDocument followed by applyDocument preserves full invalidation**
   - `store.resetToDocument(doc2)` then `store.applyDocument(doc3)` before consuming
   - `consumeApplyDocumentDiff()?.requiresFullInvalidation` is `true`

6. **local mutateDocument does not affect applyDocument diff**
   - `store.mutateDocument(new AddShape(...))` then `store.applyDocument(nextDoc)`
   - `consumeDirtyStateByLayer()` has the locally-added shape
   - `consumeApplyDocumentDiff()` has the external diff
   - Both are independently consumable

## Acceptance criteria

- `bun test` in `packages/core` passes (all existing + new tests)
- `bunx biome check --write` produces no errors
- `tsc --noEmit` passes
- `applyDocument()` writes both shape-ID dirty state (existing) and the new diff (additive)
- `consumeApplyDocumentDiff()` is exported from `packages/core/src/index.ts` (via the drawingStore barrel)
- Existing app behavior is completely unchanged (pipeline still consumes shape-ID state as before)
