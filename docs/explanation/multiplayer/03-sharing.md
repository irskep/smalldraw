# Sharing and account attachment

Sharing creates a way for another participant to join a drawing. Saving/synchronizing with an account associates drawing content with an authenticated user. These can happen together, but they are separate operations.

## Trace the flow

- `packages/splat/src/controller/createDocumentRuntimeController.ts` coordinates document operations.
- `packages/splat/src/controller/createCollaborativeUpgradeCoordinator.ts` handles the local-to-collaborative transition and metadata.
- `packages/splat/src/app/createMultiplayerApiClient.ts` calls registration, resolution and account APIs.
- `apps/server/src/trpc/appRouter.ts` exposes `registerCollaborativeDocument`, `registerAccountSyncedDocument`, `claimCollaborativeDocument`, and invitation operations.
- `packages/shared/src/index.ts` builds the drawing/join URL.

Follow the coordinator rather than treating registration as a complete local state transition. The active handle, catalog identity, access token, invite URL, thumbnail ownership and navigation may all need to agree after an upgrade.

## Anonymous ownership

A user can share without signing in. The owner credential authorizes document operations within its scope; it is not an account session. Account attachment requires authenticated server handling. `resolveDocumentClaimState` in `documents/collaboration.ts` distinguishes an owner credential from join/device access and already-attached drawings.

This explains the earlier “Claim” button after anonymous sharing: the drawing was shared but not attached to an account. User-facing wording should express the requested account action, while code still enforces credential scope. Current account-wide sync UX is being revised; do not infer its final button visibility from this historical label.

## Parental controls

The PIN is intentional soft childproofing: it discourages children from starting unwanted sharing sessions through the UI. It is not a security boundary against deliberate API use. Server authorization still owns document access. Keep these responsibilities separate when documenting or changing either flow.

## Failure boundaries

Check partial failure and retries: server registration may succeed before catalog update or navigation finishes. A stale completion must not replace a subsequently opened document. A failure should preserve the current drawing and expose a useful retry/error state rather than silently create a different empty document.
