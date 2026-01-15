# Adding a New Shape End-to-End

This repository keeps the data model (`@smalldraw/core`), renderer (`@smalldraw/renderer-konva`), and UI bindings in sync. Use this checklist whenever you introduce a new geometry so that every layer (model, renderer, tests) stays consistent.

## 1. Extend the Core Data Model

1. **Define the geometry interface** in `packages/core/src/model/geometry.ts`. Give it a unique `type` string and any parameters it needs (radii, points, etc.).
2. **Export the geometry** from `packages/core/src/index.ts` so other packages can import it.
3. **Canonicalize transforms** in `packages/core/src/model/shape.ts` if the geometry depends on world/local coordinates (e.g., point lists or paths). Update `canonicalizeShape` to normalize its data and translation.
4. **Update bounds + tools**: ensure `getGeometryLocalBounds` (same file) knows how to compute selection bounds. Add or update tool logic and undo actions if the shape is editable through user input.
5. **Add unit tests** that exercise the new geometry’s math (bounds, transforms, actions). Use Bun’s test runner in `packages/core`.

## 2. Wire up the Konva Renderer

1. **Map the geometry** in `packages/renderer-konva/src/shapes.ts`. Create a renderer function that converts the geometry into Konva nodes, respecting fills, strokes, and the canonical transform.
2. **Export any helpers** (stroke logic, gradients) you need via `packages/renderer-konva/src/index.ts`.
3. **Add a snapshot test** so the shape renders stably. Create a representative `Shape` object in `packages/renderer-konva/src/__tests__/renderDocument.test.ts` (or a new test file) and call the shared `expectSnapshot` helper.
4. **Update snapshots when necessary** by running either of these commands:
   ```bash
   bun --filter @smalldraw/renderer-konva test            # verifies snapshots
   UPDATE_SNAPSHOTS=1 bun --filter @smalldraw/renderer-konva test  # overwrites baselines
   # or use the package-level shortcut:
   cd packages/renderer-konva
   bun run test:update
   ```
   The first run fails with a helpful message if a snapshot is missing or changed; rerun with `UPDATE_SNAPSHOTS=1` only after visually confirming the PNG diff in `packages/renderer-konva/__snapshots__` is expected.

## 3. Update UI Bindings (when applicable)

1. **Expose the shape in React tooling** (`packages/ui-react`) so tools and inspectors understand it.
2. **Add icon/tooling** to the UI if the shape should be drawable from the toolbar.
3. **Write integration tests** (React-level) once the viewport/renderer snapshot passes.

## 4. Final Verification

1. Run `bun --filter '*' ts:check` to make sure TypeScript types still pass everywhere.
2. Run the renderer snapshot suite again without `UPDATE_SNAPSHOTS`. It should pass with zero diffs.
3. Commit both code and any updated PNGs under `packages/renderer-konva/__snapshots__` so CI has consistent baselines.

Following this flow ensures every new geometry is supported end-to-end—from the Automerge-friendly data model all the way to reliable visual regression tests.
