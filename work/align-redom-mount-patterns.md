# Align ButtonGrid Render Path with Idiomatic re:dom Mounting

## Problem
`ButtonGrid.render()` calls `mount(inlineHost, shell)` on every render even when `shell` is already mounted. In re:dom this still goes through mount/remount flow and adds unnecessary churn.

Affected areas:
- `apps/splatterboard/src/view/ButtonGrid.ts`

## Goal
Avoid remounting stable nodes inside hot render paths.

## Implementation Plan
1. Move one-time structural mounts to initialization:
- Keep `mount(inlineHost, shell)` in setup only.
2. In `render()`, only update dynamic concerns:
- `listView.update(...)`
- mode dataset updates
- sizing/visibility/pagination updates
3. If host switching is actually required in future, perform conditional mount only when parent changes.
4. Add a short code comment in `render()` documenting that structure is stable and only state is updated.

## Acceptance Criteria
- `render()` no longer remounts `shell` each invocation.
- Behavior is unchanged in all layout modes.
- No regressions in list updates or pager control state.

## Validation
- Run Splatterboard tests and typecheck.
- Manual smoke test on resize/pagination to ensure parity.

