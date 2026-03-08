# State of Things

What the codebase looks like heading into Splatterboard multiplayer work. Not a repo tour — just the parts that matter for this effort.

## What Ships Today

`splatterboard.app` runs from `apps/splat-web` + `packages/splat`. `packages/core` provides the drawing document model, actions, store, and Automerge-backed document adapter.

`apps/server` and `apps/app` are an unrelated Automerge demo. They're not the Splatterboard architecture, but contain reusable patterns for hosted sync, auth, and sqlite persistence.

## Package Responsibilities

**`packages/core`** owns the canonical drawing document model and the Automerge-backed store adapter. It requires a `Repo` to be injected by the caller — it no longer creates its own.

**`packages/splat`** owns the app shell, UI, document browser, document session orchestration, and local metadata/thumbnails. It currently injects a local-only repo into core.

## How the Pieces Connect

`packages/splat` creates a local Automerge repo (IndexedDB storage + BroadcastChannel networking) in `createLocalSmalldrawRepo.ts` and passes it into `createSmalldraw()` from `createKidsDrawApp.ts`.

This is the first real opening for swapping transport/storage strategies without changing core.

## What "Local Only" Means Today

Two separate local storage layers:

1. **Canonical document content** — an Automerge document in the injected repo, persisted to IndexedDB by the repo's storage adapter.
2. **Catalog metadata** — document summaries, thumbnails, and current-document bookkeeping in `KidsDocumentBackend`, also IndexedDB-backed.

Same-browser persistence comes from IndexedDB. Same-origin tab sync comes from BroadcastChannel in the repo.

Multiplayer work touches both layers, even though repo creation has been moved out of core.

## Existing Multiplayer-Relevant Code

`apps/server` has an Automerge repo over websocket with a sqlite storage adapter and session-aware auth gating. `apps/app` has a browser-side Automerge repo with websocket networking and IndexedDB local storage. Both are coupled to the demo's account and invitation model — useful as pattern sources, not as the Splatterboard architecture.

## What Blocks Multiplayer

The repo injection refactor was necessary groundwork but not sufficient. What's still missing:

- The app injects one local repo at startup. There's no per-document strategy selection.
- Storage mode isn't tracked per document.
- There's no migration flow from local-only to collaborative.
- The metadata backend and canonical content backend have no coordination layer.

## Resolved Design Decisions

These were open questions; they've been answered during design work.

**Document identity**: Upgrade preserves the local catalog identity. The `KidsDocumentSummary` record keeps its `docUrl` as the stable key. A new `collabDocUrl` field holds the collaborative Automerge URL. The catalog record links the two explicitly.

**Migration semantics**: Create/copy/commit. Create the collab doc on the server, copy current content into it, update local metadata, reopen with the collab strategy. If anything fails before the metadata commit, the local doc is untouched.

**Auth**: None. No user accounts. The server hosts anonymous Automerge docs accessible only via secret URL.

**Document browser**: Collaborative docs get a small badge on the thumbnail tile. No tabs, no filters.

**Metadata ownership**: All catalog metadata stays local — thumbnails, timestamps, titles. The server owns only the collaborative Automerge doc and sync transport. New local metadata fields are `collabDocUrl` and `joinSecret`.

**Status indicator visibility**: No indicator for local docs. The indicator only appears for collaborative docs: `Collab drawing (online)` or `Collab drawing (offline)`.

**Sharing affordance**: A Share button in the toolbar. For local docs, tapping Share triggers upgrade then shows the QR code. The upgrade is an implementation detail of sharing.

**Connectivity signal**: Websocket connection state drives online vs offline. Not `navigator.onLine` (too coarse), not sync adapter internals (too opaque).

**Repo strategy**: Likely a single repo with IndexedDB storage + BroadcastChannel + websocket adapter, rather than per-document repo selection. Local-only docs have no server-side peer so the websocket adapter has nothing to sync. Collaborative docs sync because the server has a matching document. Needs validation that Automerge's websocket adapter handles this gracefully.

## Next Steps

- Extend `KidsDocumentSummary` with collaboration fields.
- Build the upgrade migration flow in `packages/splat`.
- Stand up a Splatterboard-specific sync server.
- Wire the Share button and QR code generation.
- Add the status indicator for collaborative docs.
- Add the parent PIN and collaboration toggle.
