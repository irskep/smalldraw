# Normalize Reparenting to re:dom APIs for Lifecycle Safety

## Problem
Controller code re-parents view elements with direct DOM calls (`appendChild` / `replaceChildren`) rather than re:dom `mount`/`setChildren`. This can bypass re:dom lifecycle expectations and makes future hook usage fragile.

Affected areas:
- `apps/splatterboard/src/controller/KidsDrawController.ts`
- potentially related view composition points

## Goal
Use re:dom operations consistently when moving view-owned DOM nodes.

## Implementation Plan
1. Identify reparenting operations for:
- Toolbar panels (`top`, `left`, `right`, `bottom`)
- Mobile portrait strips/popovers
- Document overlay host
2. Replace direct DOM reparenting with re:dom calls:
- `mount(parent, child)` for single child placement/moves
- `setChildren(parent, [...])` for ordered child groups
3. Keep direct DOM APIs only for plain ephemeral nodes not managed as views (document exceptions inline).
4. Verify `destroy()` still cleanly detaches everything.

## Acceptance Criteria
- View-owned node composition uses re:dom APIs in controller layout transitions.
- No behavior regressions during profile switches (large/medium/mobile-portrait).
- Event handlers and references remain valid after moves.

## Validation
- Manual test: rotate/resize and switch profiles repeatedly.
- Run Splatterboard tests.

