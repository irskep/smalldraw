# Server responsibilities

`apps/server/src/index.ts` hosts the Express API and WebSocket upgrade path. The tRPC endpoint is `/api/v1`; procedures are defined in `apps/server/src/trpc/appRouter.ts`.

The server has two distinct persistence responsibilities:

| Data | Responsibility |
| --- | --- |
| Accounts, sessions, document metadata, membership, invitation/token scope, thumbnails | Application database and procedures under `apps/server/src/db/` and `trpc/` |
| Drawing changes/snapshots | Automerge-repo and its storage adapter under `apps/server/src/automergeRepo/` |

A database row is not proof that drawing binary content is available. Account/open procedures validate content availability and return structured failures where appropriate.

## Authentication and access

HTTP browser requests use the session cookie. The tRPC context also supports session-key authorization headers and server-admin Basic authentication. See `trpc/trpc.ts` and `auth/sessionCookie.ts` for precedence and parsing.

WebSocket upgrade authorization is separate. `wsUpgradeAuth.ts` resolves query credentials, and `automergeRepo/authAdapter.ts` enforces message/document access. Client announce policy reduces what a client offers; it does not authorize access on the server.

Account membership, ownership, invitation resolution, token revocation and server-wide administration have separate procedures. Do not treat a successful login or a valid token for one drawing as access to arbitrary document IDs.

## Where to inspect contracts

Use the procedure input/output schemas and corresponding tests in `apps/server/src/trpc/`, together with `packages/splat/src/app/createMultiplayerApiClient.ts`. The older rollout and cookie-auth plans under `apps/server/docs/` describe design history, not the current transport contract.

For local addresses and orchestration, see [development](../../guides/development.md).
