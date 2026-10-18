## Design System Guidelines

### North Star

Use Open Props as the token system, not as raw material for clever arithmetic.

### Visual Design

- Design for clarity, approachability, and character. Minimalism is not a requirement; color, illustration, and expressive typography are appropriate when they support the experience.
- Keep a coherent visual language. Reuse established palette, type, spacing, and control treatments. Extend the shared system deliberately rather than creating a new style for each screen.
- Give styling a purpose: communicate hierarchy, explain an action, show state, or establish personality. Avoid decorative effects that compete with content or obscure controls.
- Use shared components for repeated UI. Keep reusable styling in this package and page-specific composition in the application. Keep feature briefs and individual redesign plans out of these guidelines.
- Preserve readability, visible keyboard focus, distinct interaction states, and comfortable touch targets. Do not rely on color alone to communicate meaning. Respect reduced-motion preferences.
- Review visual changes in the running app and relevant harness stories, at desktop and mobile sizes and in relevant interaction and content states. Judge the rendered result, not just the CSS.

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
