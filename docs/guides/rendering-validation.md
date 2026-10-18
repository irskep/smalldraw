# Rendering validation and performance evidence

A rendering change needs a stated behavioral contract and a workload. Fewer canvases, fewer methods, or lower JavaScript time alone do not establish an improvement.

## Existing regression map

Paths below are relative to `packages/splat/src/__tests__/rendering/` unless stated otherwise.

| Contract | Evidence to inspect |
| --- | --- |
| Pending capture, cancel/dispose, failed bake recovery, resize/handoff | `rasterPipelineLifecycle.test.ts` |
| Remote layer edits and repeated offline/reconnect cycles | `multiplayerLifecycle.test.ts` |
| External document dirty regions and tile refresh | `multiplayerTiles.test.ts`, `processApplyDocumentDiff.test.ts` |
| Frozen snapshot correctness and obsolete capture work | `snapshotCapture.test.ts` |
| Immutable preview encoding and decoded geometry equivalence | `strokePreviewEncoding.test.ts` and core pen-geometry tests |
| Marker stable prefix and changing tail | `incrementalMarkerPath.test.ts`, `markerPath.test.ts` |
| Image loading/lease/export lifecycle | `deferredImageLoading.test.ts`, `snapshotService.test.ts` |
| Tile replay filtering and transformed bounds | `packages/renderer-raster/src/__tests__/tileShapeFilter.test.ts`, `tileRendererRegions.test.ts` |
| Layer-isolated output | `packages/renderer-canvas/src/__tests__/renderLayerStack.test.ts` |

Prefer real tools, stores, repo changes and native canvas pixels when they prove the contract without a browser navigation harness. Browser tests remain useful for actual input integration, visual layout, native rendering differences and frame cadence. They are not required for every state transition.

## Measure the right boundary

1. State the hypothesis, such as “an obsolete prewarm allocates canvases that cannot be used.”
2. Record document size, viewport, DPR, layers, tool, point count, image readiness and change pattern.
3. Measure before and after with the same workload, including warmups and alternating order where practical.
4. Establish output equivalence independently of the optimization. Exercise cancellation, disposal, switching and failed asynchronous work when relevant.
5. Report what the number includes and excludes. Keep raw data/probes or a reproducible permanent test for important claims.

Canvas calls can defer native work until readback or composition. A benchmark forcing `getImageData` measures a different boundary from command submission. Frame intervals include scheduling and browser composition. Allocation volume is not retained memory, and sampled JS backing storage excludes native/GPU allocations.

## Instrumentation

`packages/renderer-raster/src/perfDebug.ts` activates when `globalThis.__kidsDrawPerf` exists. In the browser console, initialize it before the operation:

```js
globalThis.__kidsDrawPerf = { counters: {}, timingsMs: {} };
```

Reset the counters/timings between phases after prior work settles. Relevant families include `composite.capture.*`, `composite.cache.*`, `composite.group.*`, `tileRenderer.snapshot.*`, `layer.<id>.bake.candidates`, `layer.<id>.bake.replayed`, and `hotLayer.*` timings.

`cancelledBeforeCopy` identifies capture attempts rejected before allocation. Started/completed/discarded attempt counts alone do not tell you how many canvases were copied. Async timings include waits and must not be summed as independent CPU work. Debug skip flags deliberately remove work; only use them to isolate a cost, not to demonstrate correct end-to-end performance.

## Audit results retained as evidence

These are historical controlled experiments from October 2026, not universal FPS claims. Detailed scripts and data were kept in the uncommitted `scratch/` investigation directory; the tests above preserve the relevant correctness contracts.

| Change | Evidence | Limitation |
| --- | --- | --- |
| Append-oriented stroke encoding and decoded-preview reuse | Avoided repeated full-history JSON work; immutable old previews and round-tripped output tested | Painting and some geometry preparation still scale with history |
| Marker stable-path reuse (`c063dd6`) | Exact path-command comparisons and browser preview comparisons | Native path copying and painting remain; do not split the stroke into separately painted batches |
| Tile replay filtering (`2c14b0d`) | Eight-tile, 600-shape spread workload: full replay 4,800 → 600; local replay 600 → 75 | Still scans candidates; dense local shapes may all replay; cold bounds have a cost |
| Image leases (`1c4c218`, `be2a149`) | Shared ownership, late callbacks, export/switch pressure tested | Active assets are not subject to the unused-cache budget; process memory is not measured by entry count |
| Fill queue and feather traversal (`e5999e9`) | 4096×2048 blank fill experiment: total sampled operation about 454 → 272 ms; complete output hashes matched | Main-thread work; includes image generation, excludes commit/tile baking; not a device-independent latency |
| Obsolete snapshot capture guard (`66b14bf`) | Three layers, DPR2, ten overlapping updates: total group + temporary layer canvases 60 → 6 | Stress overlap before bakes settle, not normal updates per RAF; valid captures still need copies |

For the snapshot experiment, 640×480 logical pixels at DPR2 changed allocated RGBA-equivalent volume from 281.25 to 28.125 MiB. That is allocation volume, not peak memory. Warm pointer-down and movement allocated no new snapshot canvases in that probe; commit/undo/redo retained their existing capture cost.

## A rejected “correctness fix”

A full-versus-partial marker repaint comparison found antialiased edge differences caused by clipped native rendering. A reduced native canvas example reproduced them without Automerge or snapshot races. The investigation did not demonstrate shifted geometry, missing segments, interior opacity changes or remote-stroke leakage.

Repainting the full scratch canvas made that comparison exact but worsened the measured DPR2 12,000-point marker RAF interval from roughly 12.4 to 17.3 ms, and eraser from 12.8 to 18.3 ms. The workaround was reverted. Do not add a blanket full/partial byte-equality requirement without first establishing a visible correctness problem and an acceptable performance tradeoff.

This does not weaken tests for layer isolation, stable pixels during remote changes, or equivalent geometry algorithms. Those test different contracts.

## Remaining investigations

- Can valid captures avoid selected group/per-layer copies while preserving immutable ownership?
- How often do overlapping prewarms occur in real browser workloads with large drawings?
- How much do full-composite line/shape/stamp previews cost compared with their geometry work?
- Can fill sampling/readback and PNG encoding be reduced further? Mask computation now runs in a worker; those remaining stages still block the main thread.
- What does real stylus input show on target devices beyond synthetic pressure tests?

These are opportunities to measure, not confirmed user-visible regressions. The evidence does not justify replacing the whole pipeline.


## Fill worker measurements (2026-10-18)

Headless Chromium, 4096×2048, four alternating runs of each implementation. The existing blank, 600-stroke and enclosed-cell fixtures produced identical RGBA SHA-256 hashes before and after. Median total fill time includes worker startup and transfer; timer gaps measure main-thread availability, not worker CPU time or peak memory.

| Fixture | Total, synchronous → worker | Worst timer gap, synchronous → worker |
| --- | --- | --- |
| Blank | 280 → 287 ms | 314 → 74 ms |
| 600 strokes | 372 → 381 ms | 409 → 107 ms |
| Enclosed cells | 132 → 143 ms | 167 → 76 ms |

The timer probe also includes post-fill pixel readback/hash setup, so its gap is not a pure fill-stage duration. The worker improves responsiveness without claiming faster total completion. A horizontal-span flood experiment was rejected because repeated large fills regressed. Permanent tests exercise real worker transfers, exact pixels, cancellation, and stale-result rejection through the tool runtime.
