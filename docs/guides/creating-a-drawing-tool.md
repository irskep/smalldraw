# Creating a drawing tool

Start from a current implementation with the same interaction shape. The old generic rectangle examples used a shape schema that no longer matches the application; source implementations are the maintained examples.

| Need | Starting point |
| --- | --- |
| Drag a line | `packages/splat/src/tools/lineTool.ts` |
| Drag a boxed shape | `packages/splat/src/tools/boxed.ts` |
| Append stroke samples or spray dots | `packages/splat/src/tools/strokeTool.ts` |
| Place a stamp | `packages/splat/src/tools/stamps/stampPlacementTool.ts` |
| Compute an immediate raster operation | `packages/splat/src/tools/fillTool.ts` |
| Selection handles and transform interaction | `packages/core/src/tools/selection.ts` |

Read [the runtime contract](../explanation/tool-runtime-model.md) and [tool rendering paths](../explanation/tool-rendering-paths.md) first.

## Implementation sequence

1. Choose the committed shape representation. Reuse an existing shape when its semantics fit; otherwise implement a shape handler and renderer and register them in the application's registries.
2. Define a `ToolDefinition`. Activation installs handlers and returns cleanup. Prefer the existing `attachPointerHandlers` and disposer helpers.
3. Capture interaction settings, layer ID and ordering on pointer-down. Publish an `AnyShape` with `toolId` and `temporary: true` as a draft.
4. Update the draft during movement. Provide conservative `setPreview` dirty bounds only when the old and new painted extent are understood. Avoid full-history serialization per sample for growing strokes.
5. On completion, commit an action using the intended layer and canonical geometry, then clear the draft and transient state. Handle a final pointer-up position according to the tool's intended behavior.
6. On cancellation or deactivation, clear without committing, stop timers and dispose subscriptions. A later pointer-up must be harmless.
7. Wire the tool into `drawingTools.ts` / `kidsTools.ts` and the UI configuration as appropriate.

Shape data uses `type`, `geometry`, `style`, `zIndex`, `layerId`, and `transform`; vectors are tuples/Vec2 values, not arbitrary `{x, y}` objects. Use the core/geometry helpers for canonicalization and bounds. Consult `packages/core/src/model/shape.ts` for the contract.

## Validation proportional to the change

Check a complete gesture through the real runtime: preview, commit, cancel, deactivation, undo/redo and layer assignment. For time-driven tools, verify that cancellation actually stops future draft production. For pressure, retain zero and align samples with points.

If painting changes, compare meaningful output through draft, committed layer and exported composition. Include opacity and erasing where supported. A test that merely checks which helper was called cannot establish correct layer isolation or handoff.

For a performance change, record the specific workload and the work eliminated. Input-dispatch time, path construction, tile replay, native raster work and whole-browser frame cadence answer different questions. See [rendering validation](rendering-validation.md).
