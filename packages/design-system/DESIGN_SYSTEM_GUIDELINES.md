## Design System Guidelines

### North Star

Use Open Props as the token system, not as raw material for clever arithmetic.

### Working Rules

- Prefer clarity over ideological purity.
  - A readable named token is better than a technically derived but unreadable expression.

- Do not invent a parallel design-token system inside `design-system`.
  - No broad `--ds-size-*` scale.
  - No second semantic scale that mirrors Open Props.

- Use Open Props directly wherever it already fits.
  - spacing
  - radii
  - shadows
  - type
  - motion
  - border sizes
  - color tokens

- When Open Props is missing a value the design system clearly needs, add a tiny explicit extension layer.
  - small
  - local
  - named plainly
  - only for actual gaps
  - likely temporary and refinable later

- Optimize for easy visual iteration.
  - Tokens should be obvious enough that changing them later is trivial.
  - Avoid giant nested `calc()` chains.
  - Avoid CSS that requires archaeology to understand sizing.

- Keep dependency direction clean.
  - `design-system` must not depend on `splat`.
  - The harness may visually mirror `splat`, but only through local fixture data.

- Preserve semantics, not app coupling.
  - Keep component APIs generic.
  - Do not let controller/store/domain types leak in from app code.

- Context stories should be trustworthy references, not stress tests.
  - If a DS layout mode is buggy, do not force the context story to depend on it just to stay "pure".
  - Use the simplest composition that matches the real UI.

- Use repeatable mechanisms.
  - Avoid one-off commands.
  - Avoid throwaway infrastructure decisions.
  - Encode normal workflows in scripts and config.

### Practical Rule

- Direct Open Props first.
- Tiny explicit extension tokens second.
- No arithmetic soup.
- No parallel token universe.
