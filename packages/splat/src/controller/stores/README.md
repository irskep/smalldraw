# Controller Store Channels

This folder contains store channels used by the `splatterboard` runtime.

## `createKidsDrawRuntimeStore`

- Purpose: app-wide runtime channel for lifecycle, document presentation, and viewport metrics.
- Publishers:
  - `KidsDrawController`: `setDestroyed(...)`
  - `DocumentRuntimeController`: `setPresentation(...)`
  - `LayoutController`: `setViewportMetrics(...)`
- Subscribers:
  - `RenderLoopController` path (via presentation identity reads)
  - `CursorOverlayController` (`subscribeViewportMetrics(...)`)
  - command/runtime guards (`isDestroyed()`)
- Lifecycle owner:
  - `KidsDrawController` owns creation and teardown ordering.

## `createDocumentSessionStore`

- Purpose: document-session state and session effect intents emitted by `DocumentSessionController`.
- Publishers:
  - `DocumentSessionController`: presentation/canvas updates + intents
- Subscribers:
  - `DocumentRuntimeController`: drains and applies intents
- Lifecycle owner:
  - `DocumentRuntimeController` owns `DocumentSessionController` lifecycle and unsubscription.

## `createDocumentPickerStore`

- Purpose: document browser state projection (`loading`, busy doc, docs, thumbnail URLs).
- Publishers:
  - `DocumentPickerController`
- Subscribers:
  - `DocumentBrowserDialogView` binding in `DocumentPickerController`
  - `NewDocumentDialogView` busy-state binding in `DocumentPickerController`
- Lifecycle owner:
  - `DocumentPickerController` owns subscription and thumbnail URL cleanup.

## `createCollaborationStatusStore`

- Purpose: derive collaboration status visibility and `online/offline` label from current document metadata + websocket connectivity state.
- Publishers:
  - multiplayer/session wiring (current doc summary)
  - websocket lifecycle wiring (connected/disconnected)
- Subscribers:
  - collaboration status indicator view (future)
- Lifecycle owner:
  - multiplayer UI/controller that owns websocket/session lifecycle.

## Channel Rules

- Keep channels narrow and explicit; avoid adding unrelated fields.
- Prefer store updates over cross-controller callback plumbing for shared runtime state.
- Every subscription must have a clear owner and disposal path.
