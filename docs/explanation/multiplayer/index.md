# Multiplayer and document identity

A drawing's local catalog entry, Automerge identity, account membership, and invitation credentials answer different questions. Treating them as a single “shared” flag leads to confusing UI and incorrect lifecycle assumptions.

## Reading order

1. [Document layer](01-automerge-as-document-layer.md): handles, actions and incoming changes.
2. [Catalog and workspaces](02-document-catalog.md): local metadata versus synchronized content.
3. [Sharing](03-sharing.md): publishing an invitation versus saving to an account.
4. [Joining](04-joining.md): resolving a link and opening the intended drawing.
5. [Server responsibilities](05-server.md): API, access metadata and binary storage.
6. [Sync and authorization](06-realtime-sync.md): HTTP sessions versus document-scoped WebSockets.
7. [Rendering lifecycle](lifecycle.md): what remains frozen, what cancels, and what reconnect tests prove.

## Terms

| Term | Meaning |
| --- | --- |
| Document handle | Automerge-repo's reactive reference to drawing content |
| `docUrl` | Catalog key used by local browsing/navigation; may differ from sync identity |
| `collabDocUrl` | Automerge identity for the server-connected document |
| Join secret | Credential embedded in an invitation URL, resolved by the server |
| Access token | Credential with a particular document scope, such as owner or device access |
| Account attachment | Server account membership/ownership metadata; independent of having a share link |
| Workspace | Guest or account-specific local storage and cross-tab namespace |
| Announce policy | Client decision about which documents to offer to a peer; not a replacement for server authorization |

An invitation can exist without the creator being signed in. Private account synchronization does not imply an invitation exists. Browser login state must come from the account session, not a drawing's collaborative metadata or a URL hint.

Account-wide synchronization/workspace integration is under active revision during this pass. These pages describe the stable boundaries and point to the current implementation; they do not freeze an unreviewed migration protocol into a public API promise.
