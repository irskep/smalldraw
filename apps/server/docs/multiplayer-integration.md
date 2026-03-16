# Multiplayer Integration Guide (Frontend)

This document is the source of truth for integrating `apps/splat-web` with `apps/server` multiplayer behavior as implemented now.

## Server base

- HTTP API: `http(s)://<server>/api` (tRPC endpoint)
- WebSocket sync: `ws(s)://<server>` (same host, upgrade request)

## CORS and allowed origins

- The server allows these origins by default:
  - Production: `https://splatterboard.app`
  - Local dev: `http://localhost:3000`
- Override with `FRONTEND_ORIGINS` as a comma-separated list.
  - Example: `FRONTEND_ORIGINS=https://splatterboard.app,http://localhost:3000`

If origin is not allowed, WS upgrade is rejected with `403 Forbidden`.

## HTTP auth model (tRPC)

- Protected tRPC procedures require `authorization` header containing `sessionKey`.
- There is no cookie/session middleware path for frontend clients here.
- If the header is missing/invalid, protected calls return `UNAUTHORIZED`.

## WebSocket auth model

WS auth now has two paths:

1. Session path (existing admin/authenticated flow)
- Connect with query param `sessionKey`.
- Example: `wss://server.example.com?sessionKey=<session-key>`

2. Token path (new anonymous multiplayer flow)
- Connect with query param `token`.
- Example: `wss://server.example.com?token=<join-secret>`
- The token is looked up in `document_invitations.token`.
- Connection is scoped to exactly one document (`document_invitations.document_id`).

If both `token` and `sessionKey` are present, `token` wins.

If auth fails, WS upgrade is rejected with `401 Unauthorized`.

## Message authorization behavior

After WS connection:

- Session-auth sockets:
  - Can sync any document the session user can access (`users_on_documents` check).
- Token-auth sockets:
  - Can sync only the single document mapped from token lookup.
  - Any message for another `documentId` is dropped.

## Awareness (ephemeral) validation behavior

For Automerge ephemeral awareness messages:

- Payload `type` must be `"awareness"` for all sockets.
- Session-auth sockets must include `userId` that matches the authenticated session user.
- Token-auth sockets do not require a `userId` match.

## Current multiplayer-relevant tRPC procedures

These already exist:

- `createAnonymousCollaborativeDocument` (public): creates a collaborative doc without user membership and returns:
  - `collabDocUrl`: Automerge URL (`automerge:<documentId>`) to open in the client
  - `joinSecret`: invitation token to embed in QR/share payload
- `resolveAnonymousCollaborativeDocument` (public): resolves a `joinSecret` and returns:
  - `collabDocUrl`: Automerge URL to open on joiner device
  - `joinSecret`: canonical token value
  - `null` when token is unknown/expired
- `createDocument` (protected): creates a document and an invitation token.
- `createOrRefreshDocumentInvitation` (protected): returns `{ token }` for a doc admin.
- `documentInvitation` (protected): reads current invitation token for a doc admin.
- `acceptDocumentInvitation` (protected): adds current user to shared document via token.

## QR URL shape

- QR URLs should be regular `splatterboard.app` frontend URLs with query params.
- The server does not require a specific QR URL format.
- The server contract is only:
  - frontend obtains `joinSecret` from `createAnonymousCollaborativeDocument`
  - joiner frontend resolves `joinSecret` via `resolveAnonymousCollaborativeDocument`
  - frontend eventually connects to server WS with `?token=<joinSecret>`

## Frontend implementation notes

- Keep local metadata authoritative in `packages/splat` (`docUrl`, `collabDocUrl`, `joinSecret`, `collaborative`).
- Use token-auth WS for anonymous collaborator devices.
- Use session-auth WS only for authenticated/admin surfaces.
- Keep QR payload format stable once chosen; server-side validation is token-based, not URL-shape-based.

## Known deferrals

- Joiner catalog key semantics:
  - Current joiner bootstrap stores `docUrl` and `collabDocUrl` as the same Automerge URL on first join.
  - This is intentional for now; strict dual-key semantics (`docUrl` as separate local catalog key) are deferred.

- Server-side orphan cleanup:
  - If anonymous collaborative creation succeeds but client upgrade flow fails before completion, server-side collaborative docs can be left unused.
  - Client now reuses pending collaborative docs across retries in-session, but hard cleanup/revocation requires a dedicated server API and is deferred.
