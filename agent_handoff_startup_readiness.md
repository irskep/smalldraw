# Agent Handoff: Startup Readiness + First-Load Render Reliability

## Context
We migrated to LayerStack/per-layer backends. A critical first-load bug was observed:
- Fresh load can show blurry coloring-page image and no committed shapes.
- Draft appears while drawing, then disappears on commit.
- Switching to another drawing and back fixes it.

A lab notebook already exists with investigation details:
- `lab_notebook_layerstack_init.md`

User intent for next session:
1. Improve startup reliability by gating interaction until the first stable frame is baked.
2. Optionally show startup progress/loading UI.
3. Add debug logging by default to aid future diagnosis.

The user is fine with startup-specific delay if it improves correctness.

---

## Ground Rules
1. Use Bun tooling only (`bun`, `mise run ...`). Do not use npm/node commands.
2. Follow repo instructions from `AGENTS.md`, `design_principles.md`, and `mise.toml`.
3. Keep ownership boundaries clear:
   - `renderer-raster`: rendering orchestration internals
   - `apps/splatterboard`: app startup policy, UI gating, debug UX
4. Avoid ad-hoc flags spread across files; introduce a small explicit startup state model.

---

## Existing Relevant Files
- `apps/splatterboard/src/controller/createDocumentRuntimeController.ts`
- `apps/splatterboard/src/controller/createRenderLoopController.ts`
- `apps/splatterboard/src/render/createRasterPipeline.ts`
- `apps/splatterboard/src/view/KidsDrawStage.ts`
- `apps/splatterboard/src/view/KidsDrawStage.css`
- `packages/renderer-raster/src/layerStack.ts`
- `lab_notebook_layerstack_init.md`

Also inspect any current staged/unstaged changes in these areas before editing.

---

## Goal State
On first load and on document switch:
1. Canvas interactions remain disabled until first stable committed frame is ready.
2. A lightweight loading overlay/progress indicator is shown during that interval.
3. Once first bake completes, interactions are enabled and overlay is removed.
4. Startup events are logged by default in a structured way for debugging.

---

## Deliverables

### 1) Startup readiness store (app-layer)
Create a small store for startup lifecycle (in `apps/splatterboard/src/controller/stores/`):
- `phase`: `booting | doc_loading | assets_loading | first_bake | ready | degraded`
- `interactionEnabled: boolean`
- `assetsTotal: number`
- `assetsLoaded: number`
- `assetsFailed: number`
- `lastBlockingReason?: string`

Add clear transition helpers, e.g.:
- `startDocLoad()`
- `setAssetsExpected(total)`
- `markAssetLoaded()` / `markAssetFailed()`
- `startFirstBake()`
- `markReady()` / `markDegraded(reason)`

Keep API minimal and explicit.

### 2) Pipeline bake completion hook
Expose a way for app code to know when all currently queued bakes are complete.
- If possible, extend `RasterPipeline` with `flushBakes(): Promise<void>`.
- Wire this to LayerStack’s bake queue flush.

### 3) Startup gating flow in controller
In `createDocumentRuntimeController` and/or orchestration layer:
1. On document load start: set phase to `doc_loading`, disable interaction.
2. After layers/presentation resolved: set phase to `assets_loading`.
3. Track required layer image assets (image layers with `image.src`).
4. When assets are ready (or acceptable timeout/failure condition reached):
   - call `pipeline.setLayers(...)`
   - call `pipeline.scheduleBakeForClear()`
   - call `pipeline.bakePendingTiles()`
   - await `pipeline.flushBakes()`
   - then set `ready` and enable interaction.

Important:
- Avoid deadlock waiting forever on missing assets.
- If assets fail, enter `degraded` and still enable interaction once a valid frame exists.

### 4) Interaction disable/enable in stage
Use startup store to gate pointer interaction:
- Easiest path: toggle `stage.overlay.style.pointerEvents` between `none` and default based on `interactionEnabled`.
- Ensure existing pointer intent wiring remains intact.

### 5) Loading/progress UI
Add a minimal loading overlay component/state in stage view.
Requirements:
- Visible while `interactionEnabled=false`.
- Show basic text (e.g., “Loading drawing…”) and optional progress counts.
- Non-intrusive; no heavy styling work needed.

### 6) Debug logging by default
Add a structured startup logger utility in app layer.
Requirements:
1. Always records to in-memory ring buffer (`globalThis.__smalldrawStartupLog`), including timestamp + event + metadata.
2. In dev: emit to `console.debug`.
3. In prod: only warnings/errors to console, but keep ring buffer.
4. Log key events:
   - document load start/end
   - layers set
   - render identity changes (if accessible)
   - assets expected/loaded/failed
   - first bake start/end
   - interaction enabled

Do not flood logs every frame.

---

## Suggested Implementation Order
1. Add startup store + logger utility.
2. Add `flushBakes()` to pipeline surface and wire implementation.
3. Integrate startup transitions in document runtime flow.
4. Add stage interaction gating + loading overlay UI binding.
5. Add targeted tests.
6. Run lint/typecheck/tests.

---

## Testing Requirements
At minimum, add/adjust tests for:
1. Startup phase transitions and interaction gate behavior.
2. First-load path: interaction remains disabled until first bake flush resolves.
3. Asset-load completion path triggers first bake and transitions to ready.
4. Degraded path: asset failure still eventually enables interaction.

If integration tests are hard, add focused unit tests around the new startup store/controller transitions.

Run:
- `bun run ts:check` in touched packages/apps
- `bun run lint` in touched packages/apps
- relevant `bun test` targets

---

## Acceptance Criteria
1. On fresh app load, initial content is not blank/blurry due to startup race.
2. User cannot draw before first committed frame is ready.
3. After ready, drawing commits persist immediately (no poof/disappear behavior).
4. Startup logs are available by default for debugging.
5. Code is typechecked, linted, and tests pass for touched scope.

---

## Notes for the Next Agent
- Start by reading `lab_notebook_layerstack_init.md` and current git diff.
- Preserve already-staged user-intended fixes unless clearly incorrect.
- If you discover a conflicting mechanism during implementation, document it in a short notebook update.
