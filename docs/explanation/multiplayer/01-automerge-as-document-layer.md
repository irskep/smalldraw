# Automerge as the Document Layer

Every drawing in smalldraw is an Automerge CRDT document. (CRDT: a data structure designed to merge concurrent edits without conflicts, without requiring a central coordinator.) This isn't just a persistence detail — Automerge is the authoritative runtime state for the document model. The drawing store reads from it, and all mutations flow through it.

## The Document Shape

The Automerge document holds everything needed to reconstruct a drawing:

```typescript
// packages/core/src/model/document.ts
interface DrawingDocumentData {
  size: DrawingDocumentSize;           // { width, height } in pixels
  presentation: DrawingDocumentPresentation; // documentType, referenceImage
  layers: Record<string, DrawingLayer>;     // layer metadata (zIndex, visible, locked, opacity)
  shapes: Record<string, AnyShape>;         // every shape in the document
  temporalOrderCounter: number;             // monotonic counter for shape ordering
}
```

The Automerge-wrapped type is `DrawingDocument = Doc<DrawingDocumentData>` — this is what you get back from handles and what the store operates on.

`layers` and `shapes` are dictionaries keyed by ID. Automerge's CRDT semantics mean that two users can add shapes concurrently without conflicts — each insertion is a distinct key in the map.

`temporalOrderCounter` deserves attention. It's a monotonic counter incremented each time a shape is created. Shapes store their counter value, which determines draw order. Because Automerge merges concurrent counter increments deterministically, two users creating shapes simultaneously get distinct ordering values.

## The Store Adapter

The `DrawingStore` in core doesn't know about Automerge directly. It talks through a `DrawingStoreAdapter` interface:

```typescript
// packages/core/src/store/drawingStore.ts
interface DrawingStoreAdapter {
  getDoc: () => DrawingDocument;
  applyAction: (event: DrawingStoreActionEvent) => void;
  subscribe: (listener: (doc: DrawingDocument) => void) => () => void;
}

// where:
interface DrawingStoreActionEvent {
  type: "apply" | "undo" | "redo";
  action: UndoableAction;
  doc: DrawingDocument;
}
```

The Automerge implementation (`packages/core/src/automerge/storeAdapter.ts`) bridges this interface to a `DocHandle<DrawingDocumentData>`:

- **`getDoc()`** calls `handle.doc()` and returns the current snapshot. If the handle returns something malformed (missing `size`), it falls back to a blank document rather than crashing.

- **`applyAction(event)`** calls `handle.change((doc) => { ... })` — Automerge's transactional mutation API. It dispatches based on `event.type`: for `"undo"`, it calls the action's `undo()` method directly; for `"apply"` and `"redo"`, it calls `applyActionToDoc()`, which runs the action's `redo()`. Automerge records the resulting diff as a change.

- **`subscribe()`** listens to both `"change"` and `"delete"` events on the handle. Change events fire when the document is mutated (locally or remotely). Delete events reset to a blank document. The listener receives the new `DrawingDocument` either way.

This is the critical insight: **the store adapter is the seam where local editing and remote sync converge.** A local brush stroke and a remote collaborator's shape deletion both arrive through the same `"change"` event on the handle. The store doesn't distinguish between them.

## The Repo

Automerge-repo is a library that manages document handles, storage, and network synchronization. It's the runtime that makes Automerge documents sync between peers. The client creates a repo at startup:

```typescript
// packages/splat/src/documents/createLocalSmalldrawRepo.ts (simplified)
const repo = new Repo({
  network: [broadcastAdapter],           // cross-tab sync within the browser
  storage: new IndexedDBStorageAdapter(), // persistent local storage
  shareConfig: {
    announce: serverAnnouncePolicy,      // controls what syncs to the server
    access: async () => true,
  },
});
```

The WebSocket adapter (for server sync) is added dynamically later, once the app knows which document to sync and has an auth token. This separation is important — the repo starts with only local capabilities.

Three things to note:

1. **Network adapters are composable.** The `BroadcastChannelNetworkAdapter` syncs across tabs in the same browser — if you open the same drawing in two tabs, they stay in sync without any server. The `BrowserWebSocketClientAdapter` syncs to the server for cross-device collaboration. They run in parallel.

2. **Storage is IndexedDB.** Automerge-repo persists document snapshots and incremental changes automatically. Documents survive page reloads without server involvement.

3. **The announce policy controls what syncs where.** Not every document should be sent to the server — only collaborative ones. The policy function decides per-document whether to announce. More on this in [Real-Time Sync](./06-realtime-sync.md).

## WASM Initialization

Automerge's core is implemented in Rust, compiled to WebAssembly. Before any Automerge operations can run, the WASM module must be loaded. This happens once at startup via `initAutomerge()` (exported from `@smalldraw/core`), which base64-decodes the bundled WASM and initializes the runtime. The guard `isWasmInitialized()` makes repeated calls safe.

## createSmalldraw: Tying It Together

`createSmalldraw()` (`packages/core/src/createSmalldraw.ts`) is the factory that wires everything up:

1. Initialize Automerge WASM
2. If a `preImport` is provided (used by the join flow, covered in [Joining](./04-joining.md)), import the binary into the repo at the specified document ID via `repo.import(binary, { docId })`
3. Read the persisted document URL from storage (localStorage or custom callback)
4. Find or create a document handle:
   - First check the repo's handle cache (important: a pre-imported document will already be cached here)
   - If a stored URL exists and isn't cached, call `repo.find(url)` with an abort signal (default 8-second timeout)
   - If the find times out or the mode is `"always-new"`, create a fresh document via `repo.create()`
5. Wait for the handle to reach `"ready"` state
6. Create a `DrawingStoreAdapter` from the handle

The returned `SmalldrawCore` object exposes `open()`, `createNew()`, `reset()`, and `createDocumentCopy()`. These are the primitives that the document session controller uses to switch between documents, and that the sharing flow uses to snapshot documents for upload.

## How a Drawing Change Flows Through Automerge

Tracing a single brush stroke end-to-end:

```
User lifts pointer
  → Tool calls store.commitDraftShape()
    → store.applyAction(createShapeAction)
      → adapter.applyAction({ type: "apply", action, doc })
        → handle.change((doc) => { applyActionToDoc(doc, action, ...) })
          → Automerge records change, emits "change" event on handle
            → adapter subscriber fires with new doc
              → store.applyDocument(newDoc)
                → store diffs shapes, marks dirty regions
                  → renderer redraws
```

The same `"change"` event fires when a remote collaborator makes a change that arrives via the sync protocol. The store applies it identically — diff shapes, mark dirty, redraw. This is why Automerge as the document layer makes multiplayer "free" at the rendering level: the renderer already handles arbitrary document diffs.
