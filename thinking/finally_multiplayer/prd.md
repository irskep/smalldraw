# Splatterboard PRD: Local-First With Optional Collaboration

## Summary

Splatterboard creates drawings locally by default. A user can share a specific drawing so a nearby friend can join. That sharing ability is on by default, but a parent can disable it with a PIN-protected setting.

Collaborative drawings stay editable offline. Changes sync when the device reconnects.

## Problem

Splatterboard needs a simple, safe local-first drawing experience that also supports a nearby collaboration flow for individual drawings.

User needs:
- A kid draws alone, then wants a friend to join.
- A parent wants to prevent collaboration on this device.
- A user wants to revisit old drawings.
- A new user should start drawing immediately.

Known storage limitation: there are no user accounts, browser storage is not durable, and Safari may delete website data after 7 days. Solving durability is out of scope for this phase.

## Goal

Every new drawing is local-only by default. A drawing can be individually upgraded to collaborative when the device setting allows it.

## Non-Goals

- User accounts
- Durable cloud backup
- Solving Safari's 7-day storage eviction
- Making drawings collaborative by default
- Sharing beyond the nearby QR flow

## Principles

- New drawings start local-only.
- Collaboration is a per-document upgrade, not a mode switch.
- The upgrade ability is on by default.
- A parent can disable it with a local PIN.
- Local-only is a first-class experience, not a degraded fallback.
- Document metadata and thumbnails are always local.
- Collaborative drawings work offline and resync later.
- The UI communicates document state without requiring users to understand storage.

## Decided

- Docs default to local-only.
- A local doc can be upgraded to collaborative.
- The upgrade ability is on by default.
- A parent can disable it with a PIN in `localStorage`.
- The parent control lives in a settings menu item.
- Metadata and thumbnails are always local.
- Nearby sharing uses a QR code encoding a secret URL.
- The user triggers collaboration via a Share button in the toolbar. For a local doc, tapping Share upgrades the doc and then shows the QR code. The upgrade is an implementation detail of sharing, not a separate action.
- A status indicator appears in the upper-left corner for collaborative docs only. Local docs show nothing — the default experience is uncluttered. The indicator states are:
  - `Collab drawing (online)` — connected and syncing.
  - `Collab drawing (offline)` — collaborative but disconnected; edits continue locally and sync later.
- In the document browser, collaborative docs show a small badge on the thumbnail. No filtering or tabs.
- Data-loss messaging is out of scope for now.

## User Flows

### 1. Kid shares a drawing with a nearby friend

A kid is drawing alone and wants a friend to join.

The kid taps Share. If the drawing is local-only and upgrades are allowed, the app upgrades it to collaborative (preserving all content), then shows a QR code. The friend scans the code and joins. The status indicator appears showing `Collab drawing (online)`.

If the upgrade fails, the local drawing stays intact.

### 2. Parent disables collaboration

A parent opens settings and uses a PIN-protected toggle to disable collaboration upgrades. The Share button disappears (or becomes inactive). All drawings remain local-only. Drawing, saving, reopening, and deletion work normally.

This is a lightweight local preference, not a hardened security boundary.

### 3. Revisiting an existing drawing

A user browses saved drawings. The browser shows thumbnails and, for collaborative docs, a small badge. Tapping a drawing reopens it. If it's collaborative, the status indicator appears.

### 4. First-time user

A new user opens Splatterboard and gets a blank drawing immediately. No document management, no collaboration concepts. Parent controls stay out of the main kid flow.

## Functional Requirements

- New drawings are local-only.
- Existing drawings can be reopened from the browser.
- A local drawing can be upgraded to collaborative via the Share action.
- Upgrade preserves the drawing's content.
- Collaborative drawings present a QR code for nearby join.
- Collaborative drawings remain editable offline.
- Offline edits resync when connectivity returns.
- A settings menu item controls collaboration upgrades behind a PIN.
- The PIN and preference live in `localStorage`.
- Document metadata and thumbnails are always local.
- A status indicator appears in the upper-left corner for collaborative docs only.
- The document browser badges collaborative docs.

## Acceptance Criteria

**Local drawing** — A new drawing starts with no status indicator visible.

**Upgrade via Share** — Tapping Share on a local drawing (when upgrades are allowed) upgrades it, shows the QR code, and the status indicator appears as `Collab drawing (online)`.

**Upgrade disabled** — When collaboration is disabled in settings, the Share action is unavailable.

**QR sharing** — A collaborative drawing shows a QR code with a secret URL when the user taps Share.

**Online status** — A collaborative drawing with connectivity shows `Collab drawing (online)`.

**Offline status** — A collaborative drawing without connectivity shows `Collab drawing (offline)`. Drawing continues to work.

**Resync** — Offline edits sync when connectivity returns without re-entering the drawing.

**Parent settings** — The collaboration toggle requires the PIN and persists the preference locally.

## UX Requirements

- The default experience feels purely local.
- Collaboration surfaces through the Share action, not as a mode or setting the kid encounters unprompted.
- With collaboration disabled, the app feels complete — nothing looks missing or broken.
- The document browser does not require understanding storage internals.

## PIN Flow

- **First-time**: When a parent taps the collaboration setting for the first time, the app prompts them to create a 4-digit PIN.
- **Change**: Enter the current PIN, then set a new one.
- **Reset**: There is no recovery mechanism. Clearing site data resets everything. This is intentional — the PIN is a lightweight local guard, not a security boundary.

## Known Limitations

- No user accounts.
- No durable recovery mechanism.
- Browser storage eviction can cause data loss.
- Safari may delete website data after 7 days.

## Risks

- Users may assume browser storage is more durable than it is.
- Parents may assume the PIN is stronger than it is.
- The upgrade flow could feel destructive if not handled smoothly.

## Success Criteria

- New users start drawing immediately.
- Returning users reopen saved drawings easily.
- A local drawing can become collaborative without losing work.
- Parents can disable collaboration without harming solo use.
- Users can tell whether a drawing is collaborative from the UI.
