# Normalize Splatterboard Design Token Usage

## Problem
The app already has a token base (`main.css`), but many overlays, colors, radii, spacings, and sizing values are still hardcoded in CSS/TS. This weakens consistency and theming flexibility.

Affected areas include:
- `apps/splatterboard/src/view/DocumentBrowserOverlay.css`
- `apps/splatterboard/src/view/ModalDialog.css`
- `apps/splatterboard/src/view/KidsDrawStage.css`
- `apps/splatterboard/src/view/KidsDrawStage.ts`
- `apps/splatterboard/src/controller/KidsDrawController.ts`
- `apps/splatterboard/src/app/createKidsDrawApp.ts`
- `apps/splatterboard/src/view/KidsDrawToolbar.ts`

## Goal
Route semantic values through a centralized token layer and remove ad hoc literals where practical.

## Implementation Plan
1. Extend `:root` token set in `apps/splatterboard/src/main.css` with semantic additions, e.g.:
- `--kd-overlay-scrim`
- `--kd-overlay-scrim-strong`
- `--kd-action-primary-bg`
- `--kd-action-primary-fg`
- `--kd-danger-bg`
- `--kd-danger-fg`
- `--kd-radius-pill`
- `--kd-icon-size-sm`
- `--kd-cursor-default-color`
- `--kd-default-stroke-color` / `--kd-default-fill-color` (TS mirror constants)
2. Replace hardcoded CSS values (`white`, raw rgb, raw px constants) with semantic tokens where they represent design choices.
3. Consolidate TS color defaults into constants aligned with CSS tokens (single source of truth policy documented in comments).
4. Keep intentional data-like literals (e.g., explicit color palette list) if product requirements demand fixed palette values; otherwise move palette to tokenized config.

## Acceptance Criteria
- Semantic UI colors and spacing constants are tokenized.
- No duplicated hardcoded values for shared surfaces/actions/overlays.
- Token naming is domain-oriented (`kd-*`) and not tied to implementation details.

## Validation
- Visual smoke test for dialogs, document browser, cursor/stamp effects.
- Ensure contrast/legibility remains acceptable.
- Run lint/typecheck/tests.

