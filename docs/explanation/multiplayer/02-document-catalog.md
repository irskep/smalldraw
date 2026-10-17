# The Document Catalog

The previous page explained how a single Automerge document works as the drawing model. But a user can have multiple drawings. The app needs to list them, track which one is open, store thumbnails, and know whether each one is collaborative. This metadata lives in the **document catalog**, separate from the Automerge documents themselves.

## Two Layers of Storage

There are two parallel persistence systems on the client:

1. **Automerge-repo's IndexedDB** — stores the actual document data (shapes, layers, presentation). Managed automatically by Automerge-repo. The app doesn't interact with this directly after setup.

2. **The catalog's IndexedDB** — stores `KidsDocumentSummary` records and thumbnail blobs. Managed by `localDocumentBackend.ts`. This is the app's own bookkeeping.

The catalog doesn't duplicate document content. It stores pointers (document URLs) and metadata (titles, timestamps, mode, collaborative status).

## KidsDocumentSummary

```typescript
// packages/splat/src/documents/types.ts
interface KidsDocumentSummary {
  docUrl: string;              // catalog URL — the primary key
  collaborative?: boolean;     // true if this doc syncs to the server
  collabDocUrl?: string;       // Automerge-repo URL for collaborative docs
  joinSecret?: string;         // token for share links
  mode: KidsDocumentMode;      // "normal" | "coloring" | "markup"
  title?: string;
  createdAt: string;           // ISO timestamp
  updatedAt: string;
  lastOpenedAt: string;
  thumbnailKey?: string;
}
```

The `docUrl` is the local catalog identifier. For a local-only document, it's also the Automerge-repo URL used to open the document. For a collaborative document, `collabDocUrl` is the URL used for Automerge-repo operations (finding, syncing), while `docUrl` remains the catalog key.

This split matters: a collaborative document has two identities. The catalog URL is stable and local. The collab URL is what the server and other peers know about.

## Local vs. Collaborative

A document starts local. It becomes collaborative when the user shares it (covered in [Sharing](./03-sharing.md)). The catalog entry gains three fields:

| Field | Before sharing | After sharing |
|-------|---------------|---------------|
| `collaborative` | absent | `true` |
| `collabDocUrl` | absent | `"automerge:<uuid>"` |
| `joinSecret` | absent | `"p0j2kmQtPV8u7..."` |

When the app needs to open a document for Automerge-repo operations, it calls `resolveDocumentOpenUrl()`:

```typescript
// packages/splat/src/documents/collaboration.ts
function resolveDocumentOpenUrl(
  docUrl: string,
  summary: KidsDocumentSummary | null,
): string {
  if (summary?.collaborative && summary.collabDocUrl) {
    return summary.collabDocUrl; // use the synced identity
  }
  return docUrl; // use the local identity
}
```

Note the two-argument signature: you always pass the `docUrl` as a fallback, plus the summary (which may be null if not yet loaded).

## The Document Backend

The catalog is accessed through `KidsDocumentBackend`:

```typescript
// packages/splat/src/documents/types.ts
interface KidsDocumentBackend {
  readonly mode: "local";
  listDocuments(): Promise<KidsDocumentSummary[]>;
  getDocument(docUrl: string): Promise<KidsDocumentSummary | null>;
  createDocument(input: KidsDocumentCreateInput): Promise<KidsDocumentSummary>;
  touchDocument(docUrl: string): Promise<KidsDocumentSummary | null>;
  deleteDocument(docUrl: string): Promise<void>;
  saveThumbnail(docUrl: string, blob: Blob): Promise<void>;
  getThumbnail(docUrl: string): Promise<Blob | null>;
  setCurrentDocument(docUrl: string): Promise<void>;
  getCurrentDocument(): Promise<string | null>;
}
```

`setCurrentDocument` / `getCurrentDocument` persist the most recently opened document URL to localStorage (with a fallback to memory). On next app launch, this URL is read to reopen the last document.

`touchDocument` updates timestamps and returns the updated summary (or null if not found). `createDocument` takes a `KidsDocumentCreateInput` (a subset of the summary fields) and returns the persisted summary.

## The Collaborative Document Index

When the sync system needs to decide whether a document should be announced to the server (the announce policy question from [Automerge as the Document Layer](./01-automerge-as-document-layer.md)), it queries the `CollaborativeDocumentIndex` (`packages/splat/src/documents/collaborativeDocumentIndex.ts`).

The index wraps an in-memory `Set` of collaborative document IDs with lazy hydration:

- On first call to `hasDocumentId()`, it loads all catalog summaries via `listDocuments()` and extracts collaborative document IDs into the set.
- Subsequent calls skip hydration and check the set directly.
- `upsertSummary()` updates the set synchronously when a document is created or upgraded, keeping the cache fresh without re-querying IndexedDB.

`hasDocumentId()` is async (it returns `Promise<boolean>`) because the first call may need to hydrate. After hydration, it's effectively a set lookup behind an async wrapper.

## Joined Documents

When a user joins someone else's collaborative document (covered in [Joining](./04-joining.md)), the catalog entry uses a special URL format:

```typescript
// packages/splat/src/documents/collaboration.ts
function buildJoinedCatalogDocUrl(collabDocUrl: string): string {
  return `catalog-collab:${automergeUrlToDocumentId(collabDocUrl)}`;
}
// e.g. "catalog-collab:abc123def456"
```

This distinguishes joined documents from locally-created ones. The `collabDocUrl` points to the same Automerge document that the sharer created; the catalog URL is a local-only identifier that won't collide with anything in the Automerge repo.

If the user clicks a join link for a document they've already joined, the app detects the existing catalog entry by matching `collabDocUrl` and reuses it instead of creating a duplicate.

## Document Session Controller

The `createDocumentSessionController()` (`packages/splat/src/controller/createDocumentSessionController.ts`) is the runtime coordinator that bridges the catalog and the core:

- **Switching documents:** Looks up the catalog entry, resolves the open URL via `resolveDocumentOpenUrl()`, calls `core.open()`, resets the store, updates timestamps.
- **Creating documents:** Calls `core.createNew()`, creates a catalog entry, persists the URL.
- **Subscribing to changes:** Listens to the core adapter for document changes, debounces thumbnail saves and metadata updates.

It doesn't know about multiplayer directly. It calls `resolveDocumentOpenUrl()` and gets back whichever URL is appropriate. The collaborative indirection is invisible to it.
