# Marker Coloring Performance Lab Notebook

## 2026-06-15 13:00 PDT

Question: marker drawing is smooth on blank documents but slow on coloring documents.

Observed facts from user logs:

- Blank document marker path is smooth.
- Coloring document marker path is slow, around 10-15 fps.
- Hiding the visible coloring page/lineart element did not restore smoothness.
- Skipping hot-layer clear, backdrop blit, draft paint, active-layer hiding, snapshot capture, tile bake scheduling, and hot-layer render did not visibly improve performance.
- Dirty-rect hot-layer redraw reduced measured render work but did not restore smoothness.

Current mental model:

- Blank document normalizes to one drawing layer: `default`.
- Coloring document normalizes to three layers: `color-under`, `lineart`, `stickers-over`.
- Marker in coloring mode targets `color-under`.
- The hot canvas is inserted immediately above the active drawing layer and below the next layer, so for marker coloring it sits below `lineart`.
- Hiding the lineart element only removes visual DOM compositing. It does not collapse the layer topology or active-layer draft-session path.

Hypothesis status:

- Hot-layer pixel work alone is unlikely to be the full cause, because skipping it did not change the perceived problem.
- The next discriminating test is topology, not another micro-skip: force the coloring page to use a one-layer raster stack containing only the active drawing layer (`color-under`) while preserving marker draft layer ids.

Temporary probe added:

- `window.__kidsDrawPerf.config.forceSingleActiveLayerStack = true`
- This makes the raster pipeline pass only the active drawing layer to `LayerStack`.
- It is live-toggleable; the pipeline reapplies the effective layer list on render when the flag changes.

Expected interpretation:

- If coloring becomes smooth with `forceSingleActiveLayerStack`, the culprit is in multi-layer topology, hot-canvas placement, or layer-stack/session behavior.
- If coloring remains slow, the cause is outside raster topology and likely in document/session/runtime behavior that differs for coloring docs.

Additional cadence probe:

- Stroke summaries now log pointer move, model invalidation, RAF, and render-pass gaps.
- The cadence line should show whether low fps comes from sparse input/model events, sparse RAF/render scheduling, or frequent renders that still feel bad.

Result:

- With `forceSingleActiveLayerStack = true` on a coloring page, marker stroke became fast.
- User log: 82.7 fps, 118 frames over 1426.4 ms, move gap avg 8.6 ms, render gap avg 11.7 ms.
- This falsifies the broad "coloring document/session/input is inherently slow" hypothesis.
- The cause is in the multi-layer raster topology or the DOM/layout/compositor behavior produced by that topology.

Next discriminating tests:

- Keep only drawing layers (`color-under`, `stickers-over`) and remove image layer from `LayerStack`.
- Keep `color-under` plus `lineart` and remove only `stickers-over`.
- Keep all layers but force hot canvas to the top of the scene during active draft.
- Compare layer DOM order and canvas sizes for each case.

Results:

- `forceDrawingOnlyLayerStack = true` stayed slow: 17.5 fps. Pointer/model cadence stayed around 9.3 ms, but RAF/render cadence dropped to 55.9 ms.
- `forceHotCanvasOnTop = true` stayed slow: 14.8 fps. Pointer/model cadence stayed around 10.0 ms, but RAF/render cadence dropped to 67.2 ms.

Interpretation:

- Removing the image layer is not sufficient.
- Putting the hot canvas above all layers is not sufficient.
- The strongest known split remains one active drawing layer is fast, while more than one layer in the scene is slow.
- The immediate symptom is not expensive render passes; RAF itself becomes sparse while input/model events remain frequent.

Next tests:

- Force only the active layer plus the image layer, excluding `stickers-over`.
- Force all non-active layer containers to `display: none` rather than only changing visual visibility or z placement.
- Inspect DOM canvas count, layer order, canvas dimensions, and computed styles in fast and slow modes.

Result:

- `forceActiveAndImageLayerStack = true` was only a little faster: 17-20 fps.
- RAF/render cadence still collapsed to around 47-51 ms while pointer cadence stayed around 9 ms.

Interpretation:

- `stickers-over` is not uniquely responsible.
- `lineart` is not uniquely responsible.
- Any second large layer surface appears enough to trigger the RAF collapse.
- The likely fix is to avoid multiple live scene canvases during an active stroke: at draft start, prepare a single hot canvas composition and hide the normal layer stack until the stroke commits.

Candidate fix:

- During an active draft session, hide all regular layer containers, not only the active layer.
- Hot canvas should become the only large visible scene canvas while drawing.
- Hot canvas must render active-layer backdrop, then draft stroke, then any visible layers above the active layer (lineart and stickers).
- Foreground/above-layer snapshots can be captured once at draft start and blitted by dirty rect during hot renders.
