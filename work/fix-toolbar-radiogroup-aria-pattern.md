# Fix Toolbar Selection Semantics (Radiogroup vs Toggle Buttons)

## Problem
Several toolbar groups are marked as `role="radiogroup"` while their child buttons use toggle-button semantics (`aria-pressed`). This mixes two accessibility patterns and can produce confusing behavior for assistive technology.

Affected areas:
- `apps/splatterboard/src/view/KidsDrawToolbar.ts`
- `apps/splatterboard/src/view/SquareIconButton.ts`

## Goal
Use one consistent, correct accessibility pattern for mutually-exclusive selections.

## Recommended Direction
Standardize these groups to the radio pattern:
- Container: `role="radiogroup"` (keep)
- Items: `role="radio"`
- Selection state: `aria-checked="true|false"`
- Keyboard support: arrow-key navigation within group (if not already provided elsewhere)

If the team prefers button toggles instead, remove `radiogroup` roles and keep `aria-pressed`. Do not mix both.

## Implementation Plan
1. Audit selection groups:
- Tool family variants
- Color swatches
- Stroke width buttons
2. Add explicit item role/state APIs in `SquareIconButton` (or a small helper):
- `setRadioSelected(selected: boolean)`
- Set `role="radio"` and `aria-checked`
3. Update `KidsDrawToolbar.ts` state application:
- Replace `aria-pressed` usage in radio groups with `aria-checked`
4. Ensure only one item per group is selected at a time.
5. Add/adjust keyboard handling if needed for radio UX.

## Acceptance Criteria
- No element inside a `radiogroup` uses `aria-pressed`.
- Exactly one selected item per mutually-exclusive group.
- Screen reader announces group/item states correctly.
- Existing pointer/touch behavior is unchanged.

## Validation
- Manual a11y check in browser accessibility tree.
- Keyboard navigation check (Tab + Arrow keys if implemented).
- Existing UI tests pass; add tests for `aria-checked` if missing.

## Status
complete
