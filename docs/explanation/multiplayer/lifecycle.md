# Multiplayer rendering and document lifecycle

Document convergence and visible presentation are separate contracts. Automerge can accept remote committed changes while the local renderer deliberately keeps an earlier scene visible for the current stroke.

## During a local stroke

The store receives document snapshots through the adapter. The raster pipeline processes dirty shape regions and can bake committed content behind the active scene. The current draft composite stays frozen; subsequent captures use the latest state. Layer visibility/order/presentation changes become visible at handoff.

This guarantees drawing against a stable scene without trying to display simultaneous in-progress strokes. A remote stroke is a committed shape by the time this path receives it.

If a collaborator deletes the local draft's layer, `DrawingStore.syncActiveLayerId` selects a surviving layer and deactivates/reactivates the current tool. Cleanup clears the old draft and stops time-driven tools. A later pointer-up cannot commit the unfinished shape into the replacement layer. Other layer changes do not imply this cancellation policy.

## Commit and cancellation

The pipeline observes drafts and manages its own session identity. It retains the completed active frame until tile bakes settle, then reveals the current committed layers. Cancelled captures and stale bake completions must not install or clear a newer session.

A viewport change during drawing preserves the captured scene's logical extent. A resize during committed-stroke handoff preserves the completed frame instead of stretching it or clearing it early.

## Switching documents and loading assets

`packages/splat/src/controller/createDocumentRuntimeController.ts` owns document opening and readiness. Async completions must verify that their document/load is still current before updating presentation, registering reference images, or requesting rendering. Switching to another document is enough to make the old completion stale even if it eventually succeeds.

`createSnapshotService.ts` captures output state and holds image ownership through loading/encoding. A later UI switch must not cause an export to substitute the newly active document's images. Pipeline disposal releases its own assets and listeners independently.

Account workspace selection and repository lifetime are being revised concurrently; check `packages/splat/src/documents/workspace.ts`, `accountWorkspace.ts`, and `app/runtimeAssembly.ts` for current integration. The renderer contracts above remain applicable across workspace changes.

## Offline and reconnect

Automerge-repo persists local document changes and exchanges missing changes on reconnection. The application still owns authorization, adapter replacement, document selection, stale completion guards and user-facing sync errors. “The CRDT converges” does not establish those lifecycle behaviors.

The native-canvas multiplayer fixture connects real repos through a controllable in-memory network. It exercises disconnects, local drafts, remote committed changes, reconnect-before/after-commit, and local undo/redo. It proves that independently received shapes survive undo of the local stroke and that layer composition is correct after handoff. It does not substitute for tests of production WebSocket authentication or every browser's offline behavior.

## Evidence

- `packages/splat/src/__tests__/rendering/multiplayerLifecycle.test.ts`: remote layer changes, active-layer deletion and repeated reconnect cycles.
- `packages/splat/src/__tests__/rendering/rasterPipelineLifecycle.test.ts`: pending capture, cancellation/disposal, bake recovery and viewport/handoff boundaries.
- `packages/splat/src/__tests__/rendering/snapshotCapture.test.ts`: stale prewarm avoidance and current-versus-next frozen scene.
- `packages/splat/src/__tests__/rendering/snapshotService.test.ts`: asynchronous output and image ownership.

When a test fails under load, inspect the first failure. A timed-out test can leave subsequent symptoms that resemble rendering corruption. Reproduce the contract before changing production scheduling or weakening assertions.
