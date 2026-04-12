# Frontend Runtime Config and Startup Intents

## Goals

- Keep bundler-specific env names out of application logic.
- Make frontend startup discrete and data-based.
- Parse all page-load inputs once into an explicit intent, then boot the app by switching on that intent.
- Avoid deriving startup meaning at several different layers.

## Runtime Config Boundary

Vite requires browser-exposed env vars to use a `VITE_` prefix. That prefix is an adapter detail and should not leak into app/package logic.

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

Boundary adapters may read Vite names:

- `VITE_DRAWING_APP_BASE_URL`
- `VITE_SYNC_SERVER_HTTP_URL`
- `VITE_SYNC_SERVER_WEBSOCKET_URL`
- `VITE_JOIN_BASE_URL`

But the rest of the app should consume `drawingAppBaseUrl`, `syncServerHttpUrl`, `syncServerWebSocketUrl`, and `joinBaseUrl` only.

## Dev Defaults

- account web: `http://localhost:3001`
- drawing app: `http://localhost:3000`
- sync server: `http://<current-host>:3030/api` and `ws://<current-host>:3030`
- join base URL: current drawing-app origin

## Startup Intent Model

Splat-web should parse page-load inputs into one intent:

```ts
type SplatStartupIntent =
  | { kind: "open-last-local" }
  | { kind: "open-share-link"; joinSecret: string }
  | { kind: "open-account-document"; documentId: string }
  | { kind: "startup-error"; message: string };
```

Rules:

- `?join=<token>` -> `open-share-link`
- `?doc=<documentId>` -> `open-account-document`
- no startup query -> `open-last-local`
- both `join` and `doc` -> `startup-error`

`apps/splat-web/src/main.ts` should switch on the intent and pass the intent to the splat package. `createKidsDrawApp` should not parse raw URL-derived fields; it should consume one explicit intent.

## Implementation Steps

1. Add account-web runtime config adapter and use it for document links.
2. Add splat-web runtime config adapter and keep current dev defaults.
3. Replace raw `joinSecret`/`accountDocumentId` multiplayer options with a `startupIntent` object.
4. Update tests to cover config adapters and intent parsing.
5. Run format/lint/typecheck/tests.
