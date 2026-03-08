# Work Sequence

How to get from where we are to working Splatterboard multiplayer, in order.

## 1. Server cleanup

The existing server (`apps/server`) is a general-purpose Automerge sync server built as a demo. It's clean and mostly app-agnostic, but needs adaptation before it can serve Splatterboard.

### What exists

- OPAQUE-based auth (username/password, no plaintext passwords ever leave the client)
- Session-based access control on both HTTP (tRPC) and WebSocket
- Document CRUD with per-user access and admin roles
- Single-token invitation system per document
- Automerge sync over WebSocket with an auth adapter that gates per-document access
- SQLite storage for both app data (Drizzle) and Automerge docs (custom adapter)
- `sharePolicy: async () => false` — the server never proactively pushes docs

### What needs to change

**Anonymous access path.** Every WebSocket connection currently requires a valid session key. Splatterboard's primary flow is anonymous — a kid taps Share, a friend scans a QR code, and they're in. The server needs to accept WebSocket connections authenticated by a document join secret rather than a user session. The existing session-based path should stay for admin use.

**Strip demo coupling.** The server's `fly.toml` references `automerge-jumpstart`, CORS defaults point at `automerge-jumpstart.vercel.app`, and the app name throughout assumes the demo. Rebrand to Splatterboard.

**CORS for Splatterboard.** Update allowed origins for `splatterboard.app` and the local dev port.

**Ephemeral message validation.** The `AuthAdapter` checks that awareness messages carry the socket's `session.userId`. Anonymous connections won't have a user ID in the same sense. This check needs to be rethought for the anonymous path.

### What to keep

- OPAQUE auth — it's already built and working. Keep it for admin accounts.
- The document/invitation/membership data model — it's generic and fits.
- The `SqliteStorageAdapter` — solid and simple.
- The `sharePolicy: false` pattern — correct for a server that only responds to client requests.

## 2. Server data model pass

Nail down the data model before building the anonymous join flow.

### Current schema

```
users (id, username, registration_record, created_at)
sessions (session_key, user_id, created_at)
login_attempts (id, user_id, server_login_state, created_at)
documents (id, name, created_at, updated_at)
users_on_documents (user_id, document_id, is_admin)
document_invitations (id, document_id, token, created_at)
```

### Decided

**Anonymous document creation.** The client calls an anonymous endpoint to create a collaborative doc. The server creates the Automerge document, generates a join token in `document_invitations`, and returns the `collabDocUrl` and token. No user row, no ownership row. The `documents` row has zero `users_on_documents` entries — already a valid state in the current schema.

**Join token is the credential.** `document_invitations.token` is the join secret embedded in QR codes. No new tables needed.

**Token-scoped WebSocket connections.** The WS upgrade handler gets a second auth path: if the URL has a `token` param (instead of `sessionKey`), the server looks up the `document_invitations` row and scopes the connection to that one document. The `AuthAdapter` enforces the scope — only sync messages for the token's document get through.

**No ownership tracking for Splatterboard docs.** Anonymous collaborative docs have no owner, no membership list, no admin role. The `users_on_documents` table is only relevant for the authenticated admin flow. The join token is the sole access control.

**No anonymous peer tracking.** Anonymous peers connect, sync, disconnect. If we ever want "2 people are here" we derive it from live WebSocket count, not DB state.

**No new document fields.** The existing `name`, `created_at`, `updated_at` columns are fine. Splatterboard won't use `name` but it's harmless. No `created_by_user_id` — anonymous docs have no creator to record.

**No session expiry changes.** Admin sessions don't expire (fine for now). Anonymous connections don't create sessions at all.

### What changes in the schema

Nothing structural. The existing tables support this as-is. The changes are in the server routes and WebSocket upgrade handler, not the data model.

## 3. Client metadata extensions

After the server data model is settled, extend `KidsDocumentSummary` in `packages/splat` with collaboration fields (`collabDocUrl`, `joinSecret`, `collaborative` flag). Wire status derivation logic. This is Phase 1 from the engineering design — the app can represent the model before the sync server is live.

## 4. Repo wiring

Add the WebSocket adapter to the client repo alongside the existing IndexedDB + BroadcastChannel adapters. Provide a `shareConfig.announce` filter that only announces collaborative docs. Validate the single-repo approach end-to-end.

## 5. Upgrade flow and Share

Build the migration coordinator in `packages/splat`. Wire the Share button: upgrade the doc (create on server, copy content, update metadata), show the QR code. The status indicator appears after upgrade.

## 6. Join flow

The other side of Share. A device scans the QR code, hits the server's join URL, and opens the collaborative doc via the sync server.

## 7. Parent controls

PIN creation, the collaboration toggle in settings, gating the Share action. This is independent of the sync work and can slot in whenever — listed last because it doesn't block any other step.
