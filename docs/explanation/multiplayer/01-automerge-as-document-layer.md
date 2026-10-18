# Automerge as the document layer

Drawing content is an Automerge document managed through an Automerge-repo handle. The drawing store also owns local editing state and undo history; it is not itself the network transport.

## Document contents

`packages/core/src/model/document.ts` defines size, presentation, layers, shapes and temporal ordering data. Shapes are keyed by ID and use the registered shape-handler contracts. Layers carry ordering and presentation metadata.

Use the existing ordering helpers rather than inventing an order from arrival time. In particular, a temporal counter is not a guarantee that concurrent peers independently assign unique sequence values. CRDT convergence does not replace application ordering rules.

## The adapter seam

`packages/core/src/automerge/storeAdapter.ts` implements the `DrawingStoreAdapter` interface from `store/drawingStore.ts`:

- `getDoc` reads the current handle snapshot.
- `applyAction` runs local apply/undo/redo intent inside `handle.change`, using an action context suitable for that transaction.
- `subscribe` listens for handle change/deletion and publishes document state to the store.

Both local commits and received remote changes produce handle notifications. The store's immutable-snapshot diff drives invalidation; receiving a remote shape does not record a new local undo action.

The adapter has a blank-document fallback for malformed/unavailable reads. This is not a successful recovery of missing account content: document-opening/server layers have separate readiness and error contracts.

## Repo and host responsibilities

`packages/splat/src/documents/createLocalSmalldrawRepo.ts` creates IndexedDB persistence and optional network adapters. Broadcast channels and storage names belong to a workspace. Server connections are attached/configured separately from the document model; authorization and announce policy restrict what can sync.

`createSmalldraw` initializes the core/store/adapter integration. App-level runtime assembly decides which document and workspace to open and when an old completion is stale. Read [lifecycle](lifecycle.md) before changing asynchronous open behavior.

Automerge supplies change merging. The app still supplies shape IDs, ordering, local history, access policy, rendering invalidation and user-facing error handling.
