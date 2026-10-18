# Joining a drawing

The web host parses startup intent before opening a document. `apps/splat-web/src/multiplayerConfig.ts` and `packages/shared/src/index.ts` define the URL boundary; `packages/splat/src/app/runtimeAssembly.ts` coordinates startup.

## Invitation to local session

A join URL carries a join secret, not a local catalog ID. The client resolves it through `resolveAnonymousCollaborativeDocument`. Server resolution provides the document identity/content/access information needed by the opening flow. The app persists appropriate catalog metadata, opens the Automerge content, and configures the scoped sync connection.

A join secret and a device/owner access token are distinct roles. Use the returned credential for its intended purpose rather than assuming the invitation URL token should be reused for every API or WebSocket operation.

## Preconditions and failure

- Invalid/revoked invitations and unauthorized account documents are access failures, not empty drawings.
- Metadata without repository content must be reported as unavailable content.
- A late resolution/readiness completion must not overwrite a newer navigation request.
- Switching away or disposing the app invalidates old rendering/image completions.
- Network reconnection can merge content, but it does not by itself repair stale UI/session ownership.

See `createDocumentRuntimeController.ts` for document-operation sequencing and [lifecycle](lifecycle.md) for rendering guarantees after open/reconnect.

## Validation boundary

URL parsing, account resolution and server authorization have their own tests. The in-memory multiplayer rendering fixture proves document convergence and pixels; it does not execute a real invitation URL or authenticate a WebSocket. Use the smallest test that covers the boundary being changed, and reserve browser navigation tests for integration behavior that requires them.
