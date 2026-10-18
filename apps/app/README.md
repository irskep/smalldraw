# Account portal

This React/Vite app owns the home page, account/session UI, account document listing and administration. The drawing editor is a separate re:dom app in `apps/splat-web`, assembled from `packages/splat`.

In local development, Tilt serves this portal at `http://localhost:3000` and proxies `/draw/` to the standalone editor at port 3001. Use that combined origin when checking login, navigation and shared drawing links.

See [development](../../docs/guides/development.md), [architecture](../../docs/explanation/architecture-overview.md), and [document identity](../../docs/explanation/multiplayer/index.md). Shared UI components live in `packages/design-system`; portal wrappers adapt those components to React.

The source of task commands is `mise.toml`. Focused checks include `mise run //apps/app:test`, `mise run //apps/app:ts:check`, and `mise run //apps/app:lint`.
