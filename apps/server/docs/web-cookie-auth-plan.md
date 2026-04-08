# Web Cookie Auth Plan

This plan replaces JS-managed first-party web sessions with ordinary server-set
cookie auth.

## Problem

Current web auth is split-brain:

- server creates a `sessionKey`
- `apps/app` stores it in `localStorage`
- requests send it in `Authorization`
- `apps/splat-web` only sees login state through an added cookie bridge

That is brittle and caused the current claim/onboarding bug.

## Target

For first-party web apps:

- server sets an HttpOnly session cookie on login
- browser sends the cookie automatically on API requests
- server resolves user session from cookie first
- frontends use `credentials: "include"`
- frontends do not manage account session material in JS

Token auth remains for:

- multiplayer share/join/device/owner document tokens
- websocket document auth
- admin CLI Basic Auth

## Delivery

### Slice 1: Server cookie support

Red:

- login route sets session cookie
- logout clears session cookie
- request context resolves session from cookie without `Authorization`

Green:

- add session-cookie helpers
- set cookie in `loginFinish`
- clear cookie in `logout`
- read cookie in `createContext`
- keep header fallback temporarily during migration

### Slice 2: Account app switches to cookie auth

Red:

- login flow works without storing session key in JS
- app auth bootstrap no longer depends on `localStorage`

Green:

- remove `Authorization` session header usage from `apps/app`
- use `credentials: "include"` on tRPC client
- redirect/login state based on `me`, not localStorage

### Slice 3: Drawing app claim path switches to cookie auth

Red:

- claim flow succeeds when logged in via account cookie only

Green:

- remove account-session bridge code from `apps/splat-web`
- send cookie credentials on multiplayer API calls
- use cookie-backed session for claim flow

### Slice 4: Delete old JS session storage

Red:

- no first-party web flow reads or writes `sessionKey` in JS

Green:

- delete session-key utility files and cookie bridge hacks
- delete account `Authorization` session header logic
- keep explicit document-token auth paths only

## Constraints

- backward compatibility is not a concern
- use red/green tests per slice
- do not auto-attach creator docs during this work; fix claim/onboarding first
