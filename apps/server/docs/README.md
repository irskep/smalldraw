# Server Docs For Frontend Engineers

This folder documents the server contracts frontend engineers should use when building multiplayer features.

## Docs

- `multiplayer-integration.md`: current HTTP + WebSocket contracts, auth modes, and multiplayer API surface.
- `account-admin-rollout-plan.md`: phased plan for server admin, account attachment, and CLI-driven rollout.

## Dev Surfaces

- `mise run server:dev`
  - API + WebSocket sync server
  - URL: `http://localhost:3030`
  - Important: this can also serve static built assets from `apps/server/public`, but that is not the live frontend dev surface.

- `mise run splat:web:dev`
  - multiplayer drawing frontend
  - URL: `http://localhost:3000`

- `mise run account:web:dev`
  - authenticated account/document management frontend
  - URL: `http://localhost:3001`

If you are iterating on frontend source, use the matching Vite dev server URL (`3000` or `3001`), not `3030`.
