# Real-time sync and authorization

Automerge-repo exchanges committed document changes. The application owns transport credentials, adapter lifetime, document selection and what the user sees while a local stroke is active.

## HTTP sessions are separate from sync credentials

The browser API client sends credentialed HTTP requests to `/api/v1`. `trpc/trpc.ts` accepts a session cookie, with additional header/admin paths. A failed network request is not proof that the browser is signed out.

`wsUpgradeAuth.ts` resolves WebSocket query credentials:

- `token` is resolved against invitation/access-token metadata and produces a document-scoped context.
- `sessionKey` produces a user-session context.
- If both are supplied, the token path takes precedence.

The editor's repo wrapper builds token-authenticated WebSocket connections. The existence of a cookie-authenticated API session does not mean every transport automatically uses cookie authentication.

## Client adapter lifetime

`packages/splat/src/documents/createLocalSmalldrawRepo.ts` manages WebSocket adapters and publishes connection state. Changing the credential can replace the adapter; changing the authorized document changes what can be announced. Reconnection and authentication failure must not let an old adapter claim ownership of the current UI/session.

Broadcast-channel adapters operate within the configured workspace namespace. They are a separate local transport, not a bypass for server-side access checks.

## Authorization on the server

`apps/server/src/automergeRepo/authAdapter.ts` intercepts document messages. Token contexts are scoped to the associated document; session contexts require account access. Awareness messages have additional payload/user checks. Consult this implementation when changing scopes or revocation; a client-side filter alone is insufficient.

## What convergence guarantees do and do not imply

The repo exchanges missing changes after reconnect and emits document-handle changes as local snapshots advance. That supplies the data path. The app must still maintain correct active document, local undo history, rendering dirty regions, image ownership and error state.

During an active local draft, the renderer intentionally delays visual incorporation of remote committed changes. Tiles can update behind the frozen scene; the latest scene appears after handoff. The [lifecycle page](lifecycle.md) covers the tested boundaries.
