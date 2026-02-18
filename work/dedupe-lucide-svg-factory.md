# Dedupe Lucide SVG Element Construction

## Problem
Lucide icon node-to-SVG creation is duplicated across multiple files, increasing drift risk and maintenance overhead.

Affected areas:
- `apps/splatterboard/src/view/SquareIconButton.ts`
- `apps/splatterboard/src/view/DocumentBrowserOverlay.ts`
- `apps/splatterboard/src/view/ModalDialog.ts`
- `apps/splatterboard/src/controller/createCursorOverlayController.ts`

## Goal
Provide one shared utility for building SVG from `IconNode` and reuse everywhere.

## Implementation Plan
1. Add a small utility module, e.g.:
- `apps/splatterboard/src/view/lucideSvg.ts`
2. Export helper(s), e.g.:
- `createLucideSvg(iconNode, options?)`
- optional className and standard stroke/viewBox defaults
3. Replace local copy-paste builders in the four call sites.
4. Keep any call-site-specific behavior (like custom class names) via options.

## Acceptance Criteria
- Icon construction logic exists in one place.
- All prior call sites compile and behave identically.
- No duplicated SVG boilerplate remains in the listed files.

## Validation
- UI smoke test for toolbar icons, modal icon, document browser icons, cursor preview icon.
- Typecheck/tests pass.

