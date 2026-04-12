# Account-Web Document Open Plan

## Decision

The drawing app (`apps/splat-web`) is canonical for opening and editing drawings. The account web app (`apps/app`) is a management/list surface. It must not own a `/documents/$documentId` editor/detail flow for opening drawings.

## Target Flow

1. Account-web lists documents returned by the authenticated server account.
2. Each document card links to the drawing app with a server document id: `/?doc=<documentId>`.
3. Splat-web startup reads `doc` from the query string.
4. The splat app calls a protected server procedure to bootstrap that document for the logged-in account.
5. The server verifies account membership, serializes the Automerge document, and returns:
   - `collabDocUrl`
   - `accessToken`
   - `accessTokenScope`
   - `content`
6. The splat app imports the content into the local repo, creates/reuses a local catalog entry, marks it account-attached, sets it current, and opens it through the existing collaborative-document path.

## Authorization Rules

- Server document membership is the authorization boundary.
- Admin document members receive an `owner` token.
- Non-admin document members receive a `device` token.
- Tokens are tagged by account and device so later server-side revocation can target individual account/device grants.
- Anonymous join links continue to use the existing `join` flow.

## Account-Web Changes

- Replace internal `Link to="/documents/$documentId"` with a normal anchor to the drawing app.
- Remove the `/documents/$documentId` route. If account-web needs management details later, it should be designed around server metadata/members, not treated as the canonical drawing opener.
- New document creation should open the new document in the drawing app instead of navigating to account-web detail.
- Drawing app base URL should be derived in dev (`localhost:3001` -> `localhost:3000`) and configurable later if needed.

## Splat-Web Changes

- Parse `?doc=<documentId>` at startup.
- Reject `join` plus `doc` together with a clear startup error.
- Pass `accountDocumentId` into `createKidsDrawApp`.

## Splat Package Changes

- Add an API client method for account document bootstrap.
- Reuse the join-bootstrap import/catalog mechanics.
- Catalog key should be stable and separate from raw Automerge URLs, using existing `buildJoinedCatalogDocUrl(collabDocUrl)`.
- Persist `accountAttached: true` so thumbnail upload and claim UI behave coherently.

## Server Changes

- Add protected tRPC query, tentatively `resolveAccountCollaborativeDocument`.
- Verify `getDocument({ documentId, userId })` succeeds.
- Serialize the Automerge document content with the same timeout/error shape used by anonymous join bootstrap.
- `findOrCreateDocumentToken` with:
  - `scope: "owner"` when `document.isAdmin`
  - `scope: "device"` otherwise
  - `tag: account:<userId>:device:<deviceTag>`

## Tests

- Server route returns bootstrap payload for a member/admin and rejects non-members.
- Multiplayer API client parses the new response and includes credentials.
- Splat app startup stores account-opened docs as account-attached collaborative docs.
- Account-web document card points at drawing app URL.
- Account-web create document opens the drawing app URL.
