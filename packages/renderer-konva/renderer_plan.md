# Renderer Implementation Plan

## Goals
- Render `@smalldraw/core` documents with Konva in both browser and headless (node canvas) contexts.
- Produce deterministic image snapshots for regression testing using `looks-same`.
- Keep the renderer module UI-agnostic so React bindings can consume the same API.

## Work Breakdown

1. **Rendering Primitives**
   - Define a `renderDocument(stage, document)` entry point that maps each shape type to Konva nodes.
   - Factor common helpers (fill/stroke serialization, transform application, z-index ordering) so shapes remain modular.
   - Ensure transforms are applied consistently (translation center, rotation, scale) based on canonical data from `@smalldraw/core`.

2. **Shape Mappers**
   - Rectangles / ellipses / regular polygons: straightforward Konva shapes with fill/stroke props.
   - Pen & stroke geometries: build paths using `perfect-freehand` output or raw line segments.
   - Polygon / path / bezier: convert geometry data into Konva `Line`/`Shape` nodes, respecting closed/open flags.
   - Provide an extension surface (e.g., registry) so new geometry types can register renderers without modifying the core switch statement.

3. **Headless Canvas + Snapshot Harness**
   - Use `konva/node` with `canvas`/`canvas-prebuilt` to create an offscreen stage.
   - Add utility to render a document to a PNG buffer and write it to a temp directory under `packages/renderer-konva/__snapshots__`.
   - Introduce `looks-same` helpers that compare generated PNGs against stored baselines with configurable tolerance (antialiasing noise, DPR scaling).

4. **Test Suite**
   - Author representative documents (single shape, multi-layer, strokes with transparency) and store golden image snapshots.
   - Tests should render via the headless harness and call `looks-same` to diff outputs; failures should emit diff images for inspection.
   - Integrate into `bun test` (or `vitest`) workflow and ensure CI dependencies (system fonts, canvas libs) are documented.

5. **API & Docs**
   - Document the renderer’s public surface (`createStage`, `renderDocument`, snapshot helpers) in `README.md`.
   - Explain how to extend the shape renderer registry and how to add new snapshot tests.

6. **Follow-ups**
   - Explore caching / dirty-region rendering once basic correctness is covered.
   - Evaluate performance implications of repeatedly creating headless stages; consider pooling if tests become slow.
   - Add hooks for hit-testing or selection overlays if future UI layers require them.

This plan should give the next engineer clear checkpoints: implement the render API, build the node-based snapshot harness, add `looks-same` regression tests, and document the workflow.
