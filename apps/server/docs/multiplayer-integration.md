# Multiplayer integration

The maintained integration explanation now lives with the main internal docs:

- [Identity and catalog](../../../docs/explanation/multiplayer/index.md)
- [Sharing](../../../docs/explanation/multiplayer/03-sharing.md)
- [Joining](../../../docs/explanation/multiplayer/04-joining.md)
- [Server](../../../docs/explanation/multiplayer/05-server.md)
- [Sync authorization](../../../docs/explanation/multiplayer/06-realtime-sync.md)

Use `/api/v1` for tRPC and credentialed HTTP requests for browser sessions. The old header-only HTTP-auth description on this page was obsolete. WebSocket credentials remain a separate contract.

Procedure schemas and tests in `apps/server/src/trpc/` are the executable reference. The editor adapter is `packages/splat/src/app/createMultiplayerApiClient.ts`. Avoid duplicating a procedure inventory here that can silently diverge from those definitions.
