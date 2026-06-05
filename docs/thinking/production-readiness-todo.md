# Production Readiness TODO

Created: 2026-06-05

## Scope

- The web app may require the network to load the JS/CSS shell.
- Document storage remains a product choice: local device storage or server-backed shared storage.
- Future bundled apps are out of scope for this web production checklist.
- Persistent sessions are acceptable.
- The drawing app already has document state indicators for local-only, online, offline, and sync-error states. This list does not treat those as missing.
- Coloring book picker improvements are out of scope for now.

## P0: First Production Launch

### Serve every account-app route on hard reload - done

Evidence:

- [apps/server/src/index.ts](../../apps/server/src/index.ts) only falls back to account `index.html` for `/`, `/login`, `/register`, and `/invitation/*`.
- [apps/app/src/routes/drawings/deleted.lazy.tsx](../../apps/app/src/routes/drawings/deleted.lazy.tsx) defines `/drawings/deleted`, but the server fallback does not include it.
- Implemented shared route matching in [packages/shared/src/index.ts](../../packages/shared/src/index.ts), wired it into [apps/server/src/index.ts](../../apps/server/src/index.ts), and added a drift test against [apps/app/src/routeTree.gen.ts](../../apps/app/src/routeTree.gen.ts).

Work:

- Replace the manual account-route fallback list with a route source that cannot drift, or explicitly cover every route and test it.

Acceptance criteria:

- Production build hard reloads return the account app for `/`, `/login`, `/register`, `/invitation/example`, and `/drawings/deleted`.
- A regression test fails when a new account route is not served by the production server fallback.

### Make production database migrations an explicit deploy gate

Evidence:

- [mise.toml](../../mise.toml) has `db:push:prod`.
- `prod:build` is correctly just a JS/static build and should not mutate the database.
- The deploy/release workflow does not currently make `db:push:prod` an explicit gate before serving code that depends on new schema.
- The deleted-drawings page failed locally until `documents.deleted_at` was applied to the dev database.

Work:

- Define the production release sequence so schema updates run before a server revision that depends on them.
- Add a lightweight startup or deploy-time check for required schema shape.

Acceptance criteria:

- A fresh production database can be migrated and served using a documented single command sequence.
- A server with missing required columns fails early with an actionable migration error, not a user-facing generic page error.

### Add admin-mediated account recovery

Evidence:

- [apps/server/src/db/schema.ts](../../apps/server/src/db/schema.ts) stores `users.registrationRecord` for OPAQUE auth and has no email field.
- No `/account`, password-change, password-reset, or recovery routes exist under [apps/app/src/routes](../../apps/app/src/routes).
- User policy: admin-mediated recovery is acceptable.

Work:

- Build an admin path that can reset or replace a user's OPAQUE registration record.
- Invalidate that user's existing sessions after reset.
- Record enough audit information to know who performed the reset and when.

Acceptance criteria:

- An admin can recover a locked-out account without direct database editing.
- Existing sessions for the recovered account are revoked.
- The account owner can log in with the new credential.

### Fix stranded login attempts

Evidence:

- [apps/server/src/db/schema.ts](../../apps/server/src/db/schema.ts) makes `login_attempts.user_id` unique.
- [apps/server/src/trpc/appRouter.ts](../../apps/server/src/trpc/appRouter.ts) rejects `loginStart` with `login already started` if a prior attempt exists.
- `loginFinish` deletes the attempt only after successful login.

Work:

- Expire, replace, or clean up stale login attempts.
- Avoid leaving an account unable to start login after an interrupted browser flow.

Acceptance criteria:

- Interrupting login after `loginStart` does not permanently block future login attempts.
- Tests cover retry after an abandoned attempt.

### Replace generic auth form errors with specific visible errors

Evidence:

- [apps/app/src/hooks/useLogin/useLogin.ts](../../apps/app/src/hooks/useLogin/useLogin.ts) catches all errors and returns `false`.
- [apps/app/src/hooks/useRegisterAndLogin/useRegisterAndLogin.ts](../../apps/app/src/hooks/useRegisterAndLogin/useRegisterAndLogin.ts) catches all errors and returns `false`.
- [apps/app/src/components/AuthForm/AuthForm.tsx](../../apps/app/src/components/AuthForm/AuthForm.tsx) has no error message slot.

Work:

- Preserve typed auth errors from the server through the hooks.
- Render concise form-level errors in the existing visual language.

Acceptance criteria:

- Wrong password, unknown account, duplicate registration, and network failure produce distinct user-visible states.
- Errors do not require checking DevTools.

## P1: Account And Server Operations

### Build the admin site deliberately

Evidence:

- [apps/server/src/trpc/appRouter.ts](../../apps/server/src/trpc/appRouter.ts) exposes `adminMe` and `adminGetUserByUsername`.
- [packages/server-cli/src/cli.ts](../../packages/server-cli/src/cli.ts) can query admin user data.
- There is no browser admin surface under [apps/app/src/routes](../../apps/app/src/routes).

Work:

- Add an admin area for user lookup, account recovery, session revocation, document lookup, membership inspection, deleted document inspection, and token inspection.

Acceptance criteria:

- Common production support tasks do not require SQLite access or ad-hoc scripts.
- Admin-only routes use server-admin auth, not normal document membership.

### Add an account settings screen

Evidence:

- The logged-in menu in [apps/app/src/routes/__root.tsx](../../apps/app/src/routes/__root.tsx) currently exposes drawings, deleted drawings, and logout behavior, but no account settings route.

Work:

- Add a user-facing account route for viewing account identity, changing password after login, and logging out of current/all sessions if supported.

Acceptance criteria:

- A logged-in user can change their password without admin help.
- The UI distinguishes account settings from drawing management.

### Surface document access management or remove dead UI

Evidence:

- [apps/app/src/components/DocumentMembers/DocumentMembers.tsx](../../apps/app/src/components/DocumentMembers/DocumentMembers.tsx) renders members, invitation links, and device-token revocation.
- Search shows no route currently mounts `DocumentMembers`.
- [apps/app/src/components/DocumentInvitation/DocumentInvitation.tsx](../../apps/app/src/components/DocumentInvitation/DocumentInvitation.tsx) rotates share links without a confirmation dialog.
- `DocumentMembers` revokes device tokens without a confirmation dialog.

Work:

- Add a document management route that uses these components, or delete the unused components until the route exists.
- Put confirmation dialogs on destructive or access-changing actions such as share-link rotation and token revocation.

Acceptance criteria:

- Document admins can inspect members and access tokens from the app.
- Rotating links and revoking tokens require explicit confirmation.

### Improve invitation accept failure handling

Evidence:

- [apps/app/src/routes/invitation/$token.lazy.tsx](../../apps/app/src/routes/invitation/$token.lazy.tsx) uses `alert("Failed to accept invitation. Please try again.")`.

Work:

- Replace `alert()` with an in-page design-system error state.
- Preserve typed server error details where available.

Acceptance criteria:

- Expired, revoked, unauthorized, and network-failed invitation accepts render recoverable page states.

### Decide thumbnail storage operating mode

Evidence:

- [apps/server/src/index.ts](../../apps/server/src/index.ts) only warns when R2 thumbnail config is incomplete.
- [apps/server/src/storage/documentThumbnailStore.ts](../../apps/server/src/storage/documentThumbnailStore.ts) throws when thumbnail storage is used without R2 config.

Work:

- Decide whether server-backed thumbnails are required in production or optional.
- If required, make missing R2 config fail health/deploy checks.
- If optional, make thumbnail endpoints fail open with an explicit typed error the client treats as non-fatal.

Acceptance criteria:

- Missing thumbnail configuration has predictable production behavior.
- Users can still open drawings when thumbnails fail.

## P2: Hardening And Cleanup

### Remove or justify non-cookie session auth

Evidence:

- [apps/server/src/trpc/trpc.ts](../../apps/server/src/trpc/trpc.ts) accepts an arbitrary non-Basic `Authorization` header as a session key after checking cookies.
- Current account/drawing web clients use cookie credentials for API calls.

Work:

- Verify whether any current non-browser client still depends on this path.
- Remove it if unused; otherwise document the API contract and tests.

Acceptance criteria:

- Session authentication has one intentional browser path and any extra paths are documented and tested.

### Give deleted drawings a retention policy

Evidence:

- [apps/server/src/db/schema.ts](../../apps/server/src/db/schema.ts) has `documents.deleted_at`.
- [apps/app/src/routes/drawings/deleted.lazy.tsx](../../apps/app/src/routes/drawings/deleted.lazy.tsx) restores deleted drawings.
- There is no purge/retention behavior in the inspected routes.

Work:

- Decide whether soft-deleted drawings are retained forever, admin-purgeable, or automatically purged after a retention window.

Acceptance criteria:

- Product copy and server behavior agree about how long deleted drawings remain recoverable.

### Add production deep-link and storage-mode UI tests

Evidence:

- Recent bugs were route/deep-link specific: `/drawings/deleted` server fallback and bad-document loading state.
- Local and shared drawings are merged in [apps/app/src/utils/documentLauncher.ts](../../apps/app/src/utils/documentLauncher.ts), with `Local` and `Shared` badges.

Work:

- Add tests for hard reloads of account routes, logged-out local drawing creation, logged-in shared drawing creation, local delete, shared delete/remove, restore, and bad-document navigation.

Acceptance criteria:

- LocalCI catches route fallback and storage-mode regressions before manual Safari testing.

### Make health checks reflect dependencies

Evidence:

- [apps/server/src/index.ts](../../apps/server/src/index.ts) returns plain `ok` from `/healthz`.
- The server has production dependencies on database schema, OPAQUE setup, optional/required R2 configuration, and static build outputs.

Work:

- Keep `/healthz` cheap, but add a deploy/readiness check that validates required runtime dependencies.

Acceptance criteria:

- Deployment can distinguish "process started" from "ready to serve account and drawing routes."
