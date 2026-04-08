# Token UX Plan

## Problem

Current multiplayer join tokens are document invitations. They work, but the UX and lifecycle are too primitive:

- anonymous share tokens are long-lived but not user-scoped
- authenticated "refresh invitation" deletes prior tokens for the document
- clients do not get a stable per-device credential after joining
- a user who has already opened a drawing can still be forced back through link-sharing semantics later

## Goal

Make "I already opened this drawing on this device" durable and unsurprising without weakening document scoping.

## Proposed Model

Use two token classes.

### 1. Share Token

Purpose: bootstrap access from a link or QR code.

Properties:

- scoped to one document
- can be revocable
- can be rotated by document owner/admin
- should not be the long-term credential the client depends on

This is close to the current `joinSecret`.

### 2. Device Access Token

Purpose: durable, per-device re-entry after the first successful join.

Properties:

- minted after a share token is redeemed
- scoped to one document
- unique per browser/device
- stored locally by the client
- survives refresh/reopen
- revocable independently from the original share token

This is the right place for the "forever token in localStorage" idea. The important refinement is: not one forever token per document for everyone, but one durable token per device per document.

## Client UX

After a join link is redeemed successfully:

1. Server returns the document payload plus a new device access token.
2. Client stores that device token locally, keyed by document id.
3. Future app startup for that document prefers the stored device token over the original `join` query param.
4. The `join` query param remains only as a bootstrap path.

Suggested local storage shape:

`kids-draw-device-access::<documentId> -> token`

IndexedDB is also reasonable if we want structured metadata and expiry timestamps.

## Server Changes

Add a new table, for example `document_device_tokens`:

- `id`
- `document_id`
- `token`
- `label` or `device_name` optional
- `created_at`
- `last_used_at`
- `revoked_at` nullable

Rules:

- redeeming a share token can mint a device token
- websocket upgrade accepts either share token or device token
- device token auth resolves directly to document access
- rotating a share token does not invalidate existing device tokens
- revoking a device token only removes that device

## Why This Is Better

Compared with reusing a single shared token forever:

- avoids breaking existing sessions when share links rotate
- allows per-device revocation
- lets share links remain distributable bootstrap credentials instead of permanent auth
- better matches user expectations: "this device remembers the drawing"

## Recommended Rollout

1. Keep current share token flow for bootstrap.
2. Add device token issuance on anonymous join resolution.
3. Prefer stored device token on reconnect/startup.
4. Add server-side revocation and simple admin UI later.

## Non-Goals

- backward compatibility with old token semantics
- multi-document account/session design
- public unauthenticated document browsing

