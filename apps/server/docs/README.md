# Server documentation

Current internal explanations are in the main docs:

- [Server responsibilities](../../../docs/explanation/multiplayer/05-server.md)
- [Sync and authorization](../../../docs/explanation/multiplayer/06-realtime-sync.md)
- [Document and rendering lifecycle](../../../docs/explanation/multiplayer/lifecycle.md)
- [Local development](../../../docs/guides/development.md)

The `*-plan.md` files here preserve rollout/design history. Verify contracts against `src/trpc/appRouter.ts`, `src/trpc/trpc.ts`, `src/wsUpgradeAuth.ts`, and their tests.

Tilt serves the portal at port 3000, the standalone drawing editor at 3001, and the API/WebSocket server at 3030. Use the portal's `/draw/` route for normal browser navigation. HTTP tRPC is mounted at `/api/v1`; browser sessions use cookies.
