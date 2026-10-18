# Tool rendering paths

Most tools share the same capture, layer isolation and handoff lifecycle. Their differences are in draft construction, geometry preparation and the amount of the hot canvas repainted. Tool implementations live in `packages/splat/src/tools/`; concrete painting lives in `packages/splat/src/shapes/`.

| Tool family | Draft and geometry work | Interactive painting | Commit/output |
| --- | --- | --- | --- |
| Marker | `strokeTool.ts`; append-oriented pen JSON previews; marker smoothing | Conservative dirty bounds; reusable stable native path prefix with a rebuilt changing tail | Canonical pen geometry; full committed/export path |
| Eraser | Same stroke mechanism, with `destination-out` | Marker path mechanism on isolated active scratch | Erases only its layer in tiles and layer-stack output |
| Pen | Stroke points plus pressure; freehand outline generation | Dirty-region composition, but outline preparation still depends on stroke history | Pressure-bearing pen geometry |
| Moving spray | Sampled dots along travelled distance | Dirty-region composition; stored dot history is replayed | Sampled dots are committed, rather than regenerated randomly on replay |
| Holding spray | Sampled dots from movement and animation-frame time | Same scene composition; a timer/frame lifecycle also owns input production | Stored sampled dots; cancellation/deactivation must stop production |
| Line | Two-point pen geometry rebuilt as endpoint changes | No stroke-tool dirty hint; full hot composition | A committed pen shape using the selected line brush style |
| Boxed shapes | Geometry rebuilt from drag endpoints | Full hot composition | Shape handler/renderer pair for the concrete shape |
| Letter/vector/image stamps | Placement/size preview; image stamps require decoded assets | Full hot composition | Stamp shape; image readiness also affects export |
| Fill | Samples the committed layered document, reads pixels, floods and feathers a mask, encodes an image | No long-lived stroke composite | One raster-fill shape on the active drawing layer |

Concrete definitions and IDs are in `drawingTools.ts` and `kidsTools.ts`. Line, boxed and stamp previews may be cheap in geometry terms while still repainting the viewport; do not infer their cost from marker measurements.

## Long-stroke representation

`packages/core/src/model/penStroke.ts` owns the pen geometry encoding/decoding helpers. The append-oriented encoder avoids serializing every prior point on every input sample. Each preview still exposes an immutable JSON value. Local preview decoding can use a captured prefix of the encoder's buffer and then cache an independent result; retained old previews must not grow when later input arrives.

This does not make the whole frame constant-time. `renderers/pen.ts` still normalizes/copies points. Freehand outline generation and spray replay depend on history. Marker prefix checking, native path copying, and painting can also scale with length.

## Marker path reuse is not incremental overpainting

`renderers/markerPath.ts` caches a stable `Path2D` prefix per scratch context. The smoother reuses an overlapping tail while preserving the existing curve construction. Shortening or replacing the input resets reuse; unchanged input can reuse the completed path. Without native `Path2D`, the full construction path is used.

The renderer still paints the entire current stroke once into the restored region. It does not independently paint batches of stroke segments. That distinction preserves translucent overlap, joins and eraser behavior. Committed output follows the full path; tests compare the geometry/commands and browser pixels for the optimized preview.

## Pressure

Pressure travels from browser input through `ToolPointerEvent` to stroke geometry. Zero is meaningful and must not be replaced by a truthiness fallback. Missing pressure and pointer-up samples have explicit handling in `tools/pressure.ts` and `strokeTool.ts`. Keep points and pressure samples aligned when changing sampling or serialization.

## Fill has a different cost model

`fillTool.ts` composes layers through `renderer-canvas`, then `floodFill.ts` computes a connected mask and feathering. Existing optimizations enqueue each pixel at most once and traverse vertical feathering with contiguous row access. They preserve tolerance, connectivity and numerical output.

A small enclosed fill can still pay for full-document composition, readback and feathering. Mask traversal, feathering and colorization run in `fillWorker.ts`, using the same pure computation tested in-process. Sampling, readback and PNG encoding remain on the main thread. The worker owns transferred input/output pixel buffers; the tool owns its lifetime and terminates it on deactivation or pointer cancellation. Only one fill runs per activation at a time; additional taps while pending are ignored.

Before encoding or committing, the tool checks that the sampled immutable document and active layer are still current. Remote edits, undo, layer changes and document switches invalidate the result. Both web and desktop builds emit `fill-worker.js` beside their HTML entry point; the web development server serves the same bundled worker.

## Adding or changing a tool

Use [the tool guide](../guides/creating-a-drawing-tool.md). Establish whether the change affects input, geometry preparation, rasterization, scene composition, or commit baking before choosing a benchmark. Use [rendering validation](../guides/rendering-validation.md) to choose meaningful evidence.
