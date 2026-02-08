# Design Principles

This document captures the engineering principles for `smalldraw` based on current architecture and recent rendering/tooling work.

## 1. Avoid Boundary Violations

Respect module ownership and keep logic in the layer that owns it.

- `core` owns document semantics, tools, actions, and state transitions.
- `renderer-*` owns rendering policy, layer composition, DPI handling, and draw pipelines.
- `apps/*` own shell concerns (mounting, inputs, app-specific UI wiring), not rendering internals.

Rules:

- Do not duplicate rendering logic in app layers when renderer packages already own it.
- Keep API boundaries explicit and minimal. Prefer small, composable contracts over leaking internal details.
- Tool contracts should describe intent/state, not renderer implementation details.
- If behavior must be shared by multiple hosts, move it down to shared packages, not copied upward into apps.
- Any cross-module coupling must be intentional, documented, and test-covered.

Thought experiments are good tools. Imagine if we were to write a second, slightly different app with a different UI. Would we need to copy/paste code between implementations? If so, consider a different path.

## 2. Efficient Rendering

Rendering should minimize work and avoid redundant pipelines.

Rules:

- During active drawing, prioritize a single hot path and defer expensive work until commit when possible.
- Use dirty bounds/dirty regions to constrain work; do not redraw full surfaces without a clear reason.
- Keep frame scheduling explicit and predictable (e.g. RAF-driven, deduplicated invalidation state machine).
- Do not trigger model churn for ephemeral preview work that can stay local to interaction state.
- Align backing store and viewport behavior with device pixel ratio to avoid blur and unnecessary resampling.
- Maintain one authoritative rendering path per behavior; avoid parallel fallback paths that diverge.
- Instrument first, optimize second. Use counters/timings and keep performance regressions testable.

## 3. Matrix and Vector Operations, Not Pairwise Arithmetic

Prefer vector/box abstractions over ad-hoc scalar `x/y` arithmetic.

Rules:

- Use `gl-matrix` operations (`Vec2.add/sub/mul/div/scale/...`) for coordinate transforms and point math.
- Use `@smalldraw/geometry` (`Box`, `BoxOperations`, `getX/getY`, etc.) for bounds and extents.
- Avoid hand-rolled pairwise arithmetic for coordinate transforms, unions, clipping, and scaling.
- Prefer typed geometric values (`Vec2Like`, `Box`) over custom `{ x, y, width, height }` transport objects unless required by external APIs.
- When external APIs require scalar args (e.g. canvas calls), derive them at the boundary from vector/box types.

## Practical Checklist

- Before adding code, identify ownership: `core`, `renderer`, or `app`.
- Before adding a new API, confirm it expresses intent instead of leaking implementation.
- Before writing `x/y` math, check whether `Vec2`/`BoxOperations` already expresses the same operation.
- Before shipping rendering changes, validate correctness and performance with automated tests and instrumentation.
