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

## 4. Store-First Runtime Design

Use stores as the authoritative runtime state channel. Imperative code should mainly publish intents/state transitions and perform unavoidable side effects at boundaries.

Rules:

- Prefer `intent -> store update -> subscriber reaction` over direct cross-controller callback chains.
- Keep stores narrow and domain-focused (for example: layout/viewport metrics, document session state, toolbar UI state), not mega state bags.
- Avoid hidden state channels (internal counters, local closure state that mirrors store data) when that state can live in a store.
- Avoid pass-through callback options when a dependency is concrete. Pass concrete collaborators directly; read shared state from stores.
- Treat stores as data surfaces and side-effect boundaries as adapters:
  - stores: pure state transitions, equality/dedup checks, computed selectors
  - adapters/controllers: I/O, timers, DOM APIs, network/storage calls
- Views own DOM event binding for elements they create. Controllers should consume intents/events and update stores, not reach into view internals.
- Subscriptions must be explicit and disposable; lifecycle ownership for every subscription/timer must be clear.
- When a flow requires ordering guarantees, model intermediate phases in store state instead of relying on temporal coupling between imperative calls.

## 5. Idiomatic RE:DOM component usage

RE:DOM has a component API. The term "view" should ~always mean "a RE:DOM component." Avoid building DOM outside of RE:DOM components. Avoid having components that expose DOM elements for direct access by callers; instead, the component should have a semantically clean API.

Avoid having components that are a thin layer over some one-off abstration. The view is the view, it's not a portal to some other weird custom thing.

Do not bypass re:dom's mount()/unmount() functions or you'll break lifecycle methods on re:dom components. Do not do direct DOM child manipulation.

Pragmatic note:

- Mixed imperative/reactive code is expected at DOM and I/O boundaries. The design goal is to keep imperative work at boundaries and keep state propagation declarative through stores.

## Practical Checklist

- Before adding code, identify ownership: `core`, `renderer`, or `app`.
- Before adding a new API, confirm it expresses intent instead of leaking implementation.
- Before writing `x/y` math, check whether `Vec2`/`BoxOperations` already expresses the same operation.
- Before adding callback plumbing between modules, ask whether a store channel should carry this state/intent instead.
- Before shipping rendering changes, validate correctness and performance with automated tests and instrumentation.
