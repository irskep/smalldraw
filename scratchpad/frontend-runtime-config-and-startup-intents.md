# Frontend Runtime Config and Startup Intents

## Goals

- Keep bundler-specific env names out of application logic.
- Make frontend startup discrete and data-based.
- Parse all page-load inputs once into an explicit intent, then boot the app by switching on that intent.
- Avoid deriving startup meaning at several different layers.

## Runtime Config Boundary

Bundler-specific env names are adapter details and should not leak into package
logic.

Internal app code should use domain config names:

```ts
type AccountWebRuntimeConfig = {
  drawingAppBaseUrl: string;
};

type SplatWebRuntimeConfig = {
  syncServerHttpUrl: string;
  syncServerWebSocketUrl: string;
  joinBaseUrl: string;
};
```

`apps/splat-web` is served by Bun's HTML dev server, not Vite. Its boundary
adapter reads Bun-inlined public env names:

- `SPLATTERBOARD_PUBLIC_SYNC_SERVER_HTTP_URL`
- `SPLATTERBOARD_PUBLIC_SYNC_SERVER_WEBSOCKET_URL`
- `SPLATTERBOARD_PUBLIC_JOIN_BASE_URL`

These values are required for drawing-app startup. Local dev config belongs in
`mise.toml` or `.env`, not as fallback behavior in application code.

`apps/app` is still Vite-based. Its boundary adapter may read:

- `VITE_DRAWING_APP_BASE_URL`

The rest of the app should consume `drawingAppBaseUrl`,
`syncServerHttpUrl`, `syncServerWebSocketUrl`, and `joinBaseUrl` only.

## Dev Configuration

- account web: `http://localhost:3001`
- drawing app: `http://localhost:3000`
- sync server: `http://localhost:3030/api` and `ws://localhost:3030`
- join base URL: `http://localhost:3000`

For LAN testing, override `SPLATTERBOARD_PUBLIC_*` in `.env` or the task
environment so join URLs and sync endpoints use the machine's LAN host.

## Startup Intent Model

Splat-web should parse page-load inputs into one intent:

```ts
type SplatStartupIntent =
  | { kind: "open-last-local" }
  | { kind: "open-local-document"; docUrl: string }
  | { kind: "open-share-link"; joinSecret: string }
  | { kind: "open-account-document"; documentId: string }
  | { kind: "startup-error"; message: string };
```

Rules:

- `?join=<token>` -> `open-share-link`
- `?doc=<documentId>` -> `open-account-document`
- `?local=<catalogDocUrl>` -> `open-local-document`
- no startup query -> `open-last-local`
- more than one document-opening query -> `startup-error`

`apps/splat-web/src/main.ts` should switch on the intent and pass the intent to the splat package. `createKidsDrawApp` should not parse raw URL-derived fields; it should consume one explicit intent.

## Implementation Steps

1. Add account-web runtime config adapter and use it for document links.
2. Add splat-web runtime config adapter using required Bun public env config.
3. Replace raw `joinSecret`/`accountDocumentId` multiplayer options with a `startupIntent` object.
4. Update tests to cover config adapters and intent parsing.
5. Run format/lint/typecheck/tests.
