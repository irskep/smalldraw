# Actions and undo

Local editing intent is represented by an `UndoableAction`. Remote document updates arrive through the store adapter and do not enter the local undo stack as new actions.

## Action contract

`packages/core/src/actions/types.ts` defines `redo`, `undo`, `affectedShapeIds`, and `affectsZOrder`. Both `redo` and `undo` return a `DrawingDocument`. `ActionContext` supplies the shape-handler registry and a `change(doc, update)` operation.

The `change` abstraction matters: the direct document path can create a new Automerge snapshot, while the repo adapter runs updates inside an existing `handle.change` transaction. An action must use that context rather than assuming every input is a freely mutable plain object.

`AddShape`, geometry/style/transform updates, deletion, clear and composite operations live under `packages/core/src/actions/`. Consult the implementation instead of copying an old abbreviated action example: canonicalization, ordering and undo data are part of the contract.

## Store, adapter and history

1. A tool calls `runtime.commit(action)`.
2. `DrawingStore` applies the action, records it in local history, tracks dirty state, and requests rendering. With an external adapter it also dispatches the action event.
3. `createAutomergeStoreAdapter` applies the operation to the current handle inside `handle.change`.
4. Handle changes update the store's document snapshot. Received remote changes use this notification path too.
5. Undo/redo operates on a locally recorded action against current state and sends the resulting mutation through the adapter.

`UndoManager` offers both direct apply/undo/redo and record/take operations used by the store's adapter path. Do not bypass the store with direct stack manipulation in UI code.

A new local action clears the redo stack. `CompositeAction` applies members in order and undoes them in reverse, letting a multi-shape operation appear as one local history entry.

## What undo does not guarantee

This is action-based local history, not a global rewind of the shared document. Reconnect tests verify that undoing our stroke preserves independently received collaborator shapes. They do not establish a universal semantic conflict policy for every concurrent edit to the same shape or deleted layer. Actions need explicit behavior for missing/replaced targets.

## Dirty tracking is part of correctness

`affectedShapeIds` and `affectsZOrder` feed rendering work. External document application also computes a structural diff between immutable snapshots. A shape that moves or changes layers must invalidate both its old and new footprints; clears and order changes can require broader invalidation.

Returning correct document data with incomplete dirty metadata can leave stale pixels. Test document results and the resulting render when changing action semantics.
