# Account And Admin Rollout Plan

This plan builds out the server without making user accounts mandatory.

Principles:

- Anonymous sharing remains first-class.
- Account-backed features layer on top of the anonymous model.
- "Ownership" is capability-based, not a special document field.
- Server-admin is separate from document-admin.
- Prefer red/green TDD for each vertical slice.
- Build no UI for this phase. Use a Bun CLI package to exercise the API.

## Current Model

The server already has two parallel worlds:

- Account-backed documents via `users_on_documents`
- Anonymous collaborative documents via token scopes (`share`, `owner`, `device`)

That is acceptable. We should not force a premature unification.

The bridge between the two worlds should be explicit:

- logged-in users can attach collaborative documents they control to their account
- later, signup/login can reconcile browser-local collaborative docs into account memberships

## Target Outcomes

After this rollout:

- a logged-in user can list account-attached docs they have access to
- a server-admin can inspect users, documents, memberships, and tokens
- local dev can bootstrap a default admin account quickly
- production can bootstrap a first admin deliberately and idempotently
- all of this can be exercised from a Bun CLI without any UI work

## Core Data Model Decisions

### 1. Do not add `documents.ownerUserId`

Reason:

- ownership is already represented by capabilities:
  - owner token
  - document admin membership
- adding an ownership field would create a second truth source

### 2. Add `users.isServerAdmin`

Reason:

- current `isAdmin` is document-scoped only
- support/debug flows need a global role

### 3. Keep anonymous docs unattached by default

Reason:

- signup must remain optional
- anonymous share/join should continue to work with no account

## Delivery Slices

## Slice 1: Server Admin Bootstrap

Goal:

- add a global server-admin role
- create an idempotent bootstrap command

Red:

- add tests proving a non-admin user is not a server-admin by default
- add tests for bootstrap:
  - creates user if missing
  - promotes existing user if present
  - is idempotent

Green:

- add `users.is_server_admin`
- add a bootstrap service
- add a Bun script in `apps/server/scripts/`
- add `mise` tasks:
  - local dev bootstrap with default username/password
  - production bootstrap with explicit env vars only

Notes:

- local dev default password can be `asdfjkl;`
- production bootstrap must not auto-run on server startup
- production bootstrap should fail fast if required env vars are missing

## Slice 2: Admin Authz Surface

Goal:

- establish a clean `serverAdminProcedure`

Red:

- tests for admin-only route access:
  - anonymous denied
  - authenticated non-admin denied
  - server-admin allowed

Green:

- extend request context to expose user admin status when authenticated
- add a `serverAdminProcedure`

Notes:

- do not mix server-admin and document-admin checks
- keep them as separate procedure helpers

## Slice 3: CLI Package

Goal:

- add a new Bun CLI package that can talk to the server over HTTP
- support HTTP Basic Auth for admin/debug workflows

Commands to support first:

- `signup`:
  - local-dev helper only
  - can read username/password from `.env`
- `me`
- `admin users get <username>`
- `admin docs get <documentId>`
- `admin docs tokens <documentId>`

CLI constraints:

- package lives under `packages/`
- no UI
- Bun only
- store config in `.env` for local use
- send HTTP Basic Auth headers for admin/debug endpoints

Why Basic Auth here:

- it is simple for operator tooling
- it avoids reproducing the full browser OPAQUE flow in the CLI
- it is acceptable for local/dev/support tooling if explicitly scoped

Important:

- Basic Auth should be a separate admin/operator auth path
- do not retrofit the user-facing browser auth flow to Basic Auth

## Slice 4: Admin Debug Endpoints

Goal:

- expose enough read-only and targeted mutation capabilities for support/debugging

Suggested endpoints:

- get user by username/id
- list user sessions
- get document by id
- list document members
- list document tokens
- revoke device token
- rotate share token
- attach document membership to user

Red:

- write route tests through admin auth

Green:

- add procedures behind `serverAdminProcedure`

Notes:

- build read surfaces first
- add mutations only where clearly needed for support

## Slice 5: Attach Collaborative Docs To Account

Goal:

- let a logged-in user attach a collaborative document they control to their account

Mechanism:

- client presents a capability-bearing token
- server verifies it
- server inserts `users_on_documents(userId, documentId, isAdmin=true)`

Acceptable tokens:

- owner token
- later maybe document-admin session path, but owner token is enough for first slice

Red:

- tests for attach flow:
  - valid owner token attaches membership
  - invalid token rejected
  - idempotent if already attached

Green:

- add one protected procedure for account attachment

## Slice 6: Local Reconciliation At Signup/Login

Goal:

- sync browser-local collaborative docs into the user account

Mechanism:

- browser scans local stored docs
- for each collaborative doc with an owner-capable token, call attach API
- ignore failures per-doc and continue

Notes:

- this is explicitly later than the server/admin work
- no UI required initially

## Testing Strategy

For each slice:

1. write failing DB/service tests first
2. write failing router tests second if there is HTTP/trpc surface
3. implement the minimum code to pass
4. run:
   - relevant package tests
   - typecheck
   - lint
5. only then move to the next slice

Suggested command cadence:

```sh
bun run --cwd apps/server test
bun run --cwd apps/server ts:check
bun run --cwd apps/server lint
```

For CLI slices:

```sh
bun run --cwd packages/<new-cli-package> test
bun run --cwd packages/<new-cli-package> ts:check
bun run --cwd packages/<new-cli-package> lint
```

## Recommended Implementation Order

1. Slice 1: server-admin bootstrap
2. Slice 2: server-admin procedure/authz
3. Slice 3: CLI package skeleton
4. Slice 4: first admin debug endpoints
5. Slice 5: attach collaborative doc to account
6. Slice 6: browser reconciliation

## Non-Goals For This Phase

- no frontend UI for admin flows
- no requirement that users sign up
- no attempt to collapse anonymous and account-backed docs into one model
- no document ownership column
