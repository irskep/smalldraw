# Splatterboard Multiplayer: High-Level Engineering Design

Translates the PRD into architectural decisions and phased delivery. Intentionally above implementation detail — focuses on boundaries, runtime model, migration, and responsibilities.

Assumes the current state described in [state_of_things.md](./state_of_things.md).

## Requirements This Design Satisfies

From the PRD:
- New drawings start local-only.
- A local drawing can be upgraded to collaborative via the Share action.
- The upgrade ability is on by default; a parent can disable it with a PIN in `localStorage`.
- Collaborative drawings work offline and resync on reconnect.
- Metadata and thumbnails are always local.
- Nearby join uses a QR code with a secret URL.
- The status indicator is hidden for local docs and shows `Collab drawing (online)` or `Collab drawing (offline)` for collaborative docs.

## Current Constraints

- The app has a working local-first document flow and local metadata catalog.
- Automerge supports the offline-editing model collaborative docs need, as long as they keep a local replica.
- Document-opening strategy is chosen once at app startup, not per document.
- There's no representation of per-document storage mode.
- There's no local-to-collaborative migration flow.
- There's no Splatterboard-specific sync server.
- Metadata and canonical content are separate systems with no coordinating abstraction.

## Design Direction

1. Keep local metadata and thumbnails in `packages/splat` as the document catalog.
2. Add per-document collaboration state to local metadata.
3. Use a single Automerge repo with all adapters (IndexedDB + BroadcastChannel + websocket) rather than per-document repo selection. Local-only docs have no server-side peer so they stay local naturally. Collaborative docs sync because the server has a matching document.
4. Treat "upgrade to collaborative" as a migration: create a collaborative doc on the server, copy current content, update local metadata, continue the session.
5. Keep a local replica for collaborative docs so they work offline.

This preserves the local-first model while making collaboration a document-level capability.

## Responsibility Split

### `packages/core`

Owns: the drawing document model, the Automerge store adapter, document open/create/reset against an injected repo.

Does not own: whether a doc is collaborative, how docs are discovered, migration between modes, parent settings, browser metadata.

Core stays the document engine. Product policy lives elsewhere.

### `packages/splat`

Owns: document catalog metadata, collaboration eligibility settings, parent PIN storage, document mode selection when opening, migration orchestration, collaboration status derivation, the Share/QR surface.

This is the product coordination layer.

### Sync server

Owns: collaborative document authority, document discovery via secret URL, sync transport.

Does not own: the document browser, thumbnails, local-first startup behavior.

## Data Model Changes

### Extended document metadata

Each `KidsDocumentSummary` record gains:
- `collaborative: boolean` — whether this doc has been upgraded (or inferred from presence of `collabDocUrl`)
- `collabDocUrl: string` — the Automerge URL the server knows
- `joinSecret: string` — the secret for QR sharing

The catalog record's existing `docUrl` stays the stable key. `collabDocUrl` is a separate field, explicitly linked. Don't collapse them.

Everything else — title, timestamps, mode, thumbnail — stays as-is.

### Thumbnails stay local

The document browser never depends on network access. Collaborative status is additional metadata, not a reason to move thumbnails to the server.

## Runtime Model

### Document modes

At the storage level, a doc is either local-only or collaborative. This is a durable property stored in local metadata.

At the UI level, the status indicator has two visible states (hidden for local docs):
- `Collab drawing (online)`
- `Collab drawing (offline)`

Connectivity is transient runtime state derived from websocket connection status.

### Repo strategy

A single Automerge repo with:
- IndexedDB storage (all docs persist locally)
- BroadcastChannel networking (same-origin tab sync)
- Websocket adapter pointed at the sync server

Local-only docs: the server has no matching document, so the websocket adapter ignores them. They behave exactly as they do today.

Collaborative docs: the server has the document, so the websocket adapter syncs it. The local IndexedDB replica provides offline editing.

This avoids per-document repo selection and means `core.open(url)` doesn't change. The difference between local and collaborative is whether the server knows about the doc.

**Important**: by default, Automerge's repo announces every local document to every peer on connect (one sync message per doc). The repo accepts a `shareConfig.announce(peerId, documentId)` callback that gates this per-peer, per-document. We need to provide one that only returns `true` for documents whose `documentId` matches a known `collabDocUrl` in local metadata. This keeps the hundreds of local-only docs from being pushed at the server on every websocket connect.

### Runtime lifecycle

The current model (one repo, one strategy, for the whole session) still works if we use a single repo with all adapters. No need to recreate core when switching documents. `core.open(docUrl)` already swaps the Automerge handle — it just needs to be called with the right URL (the local `docUrl` for local docs, the `collabDocUrl` for collaborative ones).

## Upgrade Flow

### From the user's perspective

The user taps Share. The drawing goes collaborative and a QR code appears. It feels like sharing, not a mode change.

### Engineering sequence

1. User taps Share on a local drawing.
2. `packages/splat` checks the parent setting. If disabled, the action is blocked.
3. If allowed:
   - Create a collaborative document on the sync server. This gives back a `collabDocUrl` and a `joinSecret`.
   - Copy the current Automerge doc's content into the collaborative document.
   - Update local metadata: set `collaborative`, store `collabDocUrl` and `joinSecret`.
   - Reopen the session against `collabDocUrl` so sync starts flowing.
4. Show the QR code.
5. The status indicator appears showing `Collab drawing (online)`.

### Failure handling

If anything fails before the metadata commit, the local drawing stays intact. The migration is create/copy/commit — not destructive in-place replacement.

## Offline Behavior

For collaborative docs:
- Local editing continues while offline. Edits queue in the local Automerge replica.
- Sync resumes when the websocket reconnects.
- The status indicator switches between online and offline based on websocket state.
- Editing works in both states.

## Parent Control

The parent control gates the Share action (which is the only path to collaboration). It does not affect local drawing, opening, saving, or deletion.

State:
- A 4-digit PIN and a "collaboration allowed" boolean, both in `localStorage`.
- First-time: prompt to create the PIN.
- Change: enter current PIN, set new one.
- Reset: clear site data. No recovery mechanism — intentionally lightweight.

This is app policy state owned by `packages/splat`, separate from any document record.

## QR / Join Design

A collaborative doc has a `joinSecret` stored in local metadata. The QR code encodes a URL containing this secret. The secret URL routes to the sync server, which grants access to the collaborative Automerge document.

The exact secret format and URL structure are not defined here.

## New Abstractions in `packages/splat`

### Collaboration policy store
Owns: whether upgrades are allowed, parent PIN state. Read by the Share action to gate the flow.

### Migration coordinator
Owns: creating the server-side doc, copying content, committing metadata, rollback on failure. Used by the Share action.

### Collaboration status derivation
Owns: reading document metadata + websocket state to produce the UI status. Feeds the status indicator.

## Phases

### Phase 1: Metadata and state model
- Add collaboration fields to `KidsDocumentSummary`.
- Add parent policy state and settings storage.
- Add status derivation logic (without a real server yet).
- The app can represent the future model before hosted sync exists.

### Phase 2: Sync server and repo wiring
- Stand up the Splatterboard sync server.
- Add the websocket adapter to the repo.
- Validate that local-only docs are unaffected by the websocket adapter.

### Phase 3: Upgrade flow and Share
- Build the migration coordinator.
- Wire the Share button: upgrade + QR code.
- Status indicator appears after upgrade.

### Phase 4: Join flow
- Implement the secret URL join path.
- A scanning device opens the collaborative doc via the sync server.

## Not Defined Here

- Server API shape
- Secret URL format
- UI layouts
- Cryptographic or security model
- Long-term durability solution
