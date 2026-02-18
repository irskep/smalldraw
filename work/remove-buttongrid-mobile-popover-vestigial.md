# Remove Vestigial ButtonGrid Mobile Popover Path

## Problem
`ButtonGrid` still contains a mobile popover implementation path (trigger, close button, popover DOM/CSS), but render logic hard-hides it and no open/close behavior is wired. This is dead code and increases maintenance cost.

Affected areas:
- `apps/splatterboard/src/view/ButtonGrid.ts`
- `apps/splatterboard/src/view/ButtonGrid.css`

## Goal
Delete unused mobile-popover code and leave a single active layout path.

## Implementation Plan
1. Remove unused TS members and DOM nodes:
- `mobileTriggerButton`
- `mobileCloseButton`
- `mobileHeader`
- `mobileBody`
- `mobilePopover`
2. Remove related interface surface:
- `ButtonGrid.mobileTriggerButton` from exported type (if no callers depend on it).
3. Delete render-time references:
- Hardcoded `.hidden` assignments for removed nodes.
4. Delete vestigial CSS rules:
- `.button-grid-mobile-trigger*`
- `.button-grid-mobile-popover*`
- `.button-grid-mobile-header*`
- `.button-grid-mobile-close*`
- `.button-grid-mobile-title`
- `.button-grid.is-mobile-open ...`
5. Re-run typecheck and update call sites if compile errors reveal hidden coupling.

## Acceptance Criteria
- No symbol/reference to mobile popover path remains in `ButtonGrid`.
- Public API no longer exposes unused `mobileTriggerButton`.
- Layout behavior remains unchanged across large/medium/mobile modes.
- CSS has no dead selectors for removed elements.

## Validation
- `mise run //apps/splatterboard:ts:check`
- `mise run //apps/splatterboard:test`
- Manual check: tool grids still paginate and render correctly on mobile viewport.

## Status
complete
