# Multiplayer and Client-Server Interactions

This section explains how smalldraw turns a local, single-user drawing into a collaborative document that syncs between browsers in real time. It's structured to build understanding from the ground up.

## Reading Order

1. **[Automerge as the Document Layer](./01-automerge-as-document-layer.md)** — How the drawing document lives inside an Automerge CRDT, how changes propagate through the store adapter, and what the repo abstraction provides.

2. **[The Document Catalog](./02-document-catalog.md)** — How the app tracks multiple documents, distinguishes local from collaborative, and persists metadata in IndexedDB alongside the Automerge data.

3. **[Sharing: Upgrading a Local Document](./03-sharing.md)** — What happens when a user clicks "Share." The document copy, server registration, join secret generation, and the collaborative upgrade coordinator. Introduces the controller layer.

4. **[Joining: Resolving a Share Link](./04-joining.md)** — The joiner's perspective. URL parsing, server resolution, binary import, and bootstrapping the collaborative session.

5. **[The Server](./05-server.md)** — Express + tRPC + Automerge repo. Document storage, invitation management, and the anonymous collaboration flow.

6. **[Real-Time Sync and Authorization](./06-realtime-sync.md)** — WebSocket upgrade, the auth adapter, announce policies, and how Automerge-repo handles the actual CRDT synchronization.

## Key Terminology

| Term | Meaning |
|------|---------|
| **CRDT** | Conflict-free Replicated Data Type. A data structure that merges concurrent edits without conflicts and without a central coordinator. Automerge is one implementation. |
| **Automerge-repo** | Library that manages Automerge document handles, persistence, and network sync. Both client and server run their own repo instance. |
| **Document handle** | Automerge-repo's `DocHandle<T>` — a reactive reference to a document that emits change events when the document is mutated locally or remotely. |
| **Catalog document** | Local metadata entry in IndexedDB (a `KidsDocumentSummary`). Tracks title, timestamps, thumbnails, and whether the document is collaborative. Identified by `docUrl`. |
| **Collaborative document** | An Automerge document that syncs to the server. Has a `collabDocUrl` (e.g. `automerge:abc123`) and a `joinSecret`. |
| **`docUrl` vs `collabDocUrl`** | A collaborative document has two URLs. `docUrl` is the local catalog key. `collabDocUrl` is the Automerge-repo identity known to the server and other peers. |
| **Join secret** | A random token embedded in share URLs. The server maps it to a document. Also used as the WebSocket auth token for anonymous collaboration. |
| **Announce policy** | A function that decides whether to announce a document to a given peer. Controls what syncs to the server vs. what stays local. |
| **tRPC** | A TypeScript RPC framework providing end-to-end type safety between client and server. The server exposes tRPC procedures; the client calls them as typed functions. |
