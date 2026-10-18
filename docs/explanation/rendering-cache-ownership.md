# Rendering cache ownership

Several objects contain similar-looking pixels but have different owners and lifetimes. Keep those distinctions explicit when reducing copies or retention.

## Owners and invalidation

| Owner | Data | Lifetime/invalidation |
| --- | --- | --- |
| `TileRenderer` within a drawing-layer backend | Committed tile canvases and shape/tile bookkeeping | Shape/region dirtying, layer changes, render identity, viewport/DPR, disposal |
| Image-layer backend | Reference-image canvas | Image readiness, layer metadata, viewport, invalidation, disposal |
| `LayerStack.compositeCache` | Prepared next-session below/active/above snapshots, or pending capture | Content/version and identity/layer/viewport key changes |
| `LayerStack.activeLayerDraftComposite` | Current session's frozen scene | Retained through content invalidation; released at session end/disposal |
| Pipeline `draftSession` | Current capture/active/handoff identity | New draft, cancellation, document/layer replacement, disposal |
| `HotLayer.activeScratch` | Mutable active-layer working canvas | Reused and restored for each paint; backing resized with viewport |
| Pipeline `completedFrame` | Preserved ending frame during backing resize | Only needed until handoff completes |
| Marker preview path cache | Input prefix and native paths | Weakly keyed by scratch context; reset for incompatible input |
| Tile shape filter | Conservative paint bounds | Weakly keyed by immutable committed shape objects |
| Raster image cache | Shared pending/decoded images and failure timestamps | Explicit leases plus bounded unused entries |
| Snapshot service | Captured-document output and asset lease | Through asynchronous loading/encoding, released afterward |

The optional tile snapshot store/adapter in `renderer-raster/src/snapshots.ts` is not installed by the production drawing-layer backend. Do not count it as another active cache without tracing the actual constructor path.

## Next-session cache versus current-session snapshot

Invalidating the prewarm cache must not mutate the active frozen composite. Remote updates can invalidate and prepare the next session while the current stroke keeps its original scene.

`captureDraftComposite` first waits for `flushBakes`. It then checks its version before allocating group and per-layer copies. Obsolete prewarms settle without making those copies. A waiting current session retries the current generation. Publication and session-installation checks also protect against work becoming stale later.

A current capture may still allocate temporary per-layer viewport canvases and group canvases. Drawing-layer snapshots stitch tiles; image backends can provide their existing canvas, which is copied into the group. The group owns pixels independent of later backend mutation. Skipping obsolete captures does not eliminate the copies needed by a valid capture.

## Resizing

Snapshots record their logical extent separately from backing resolution. A viewport/DPR change must preserve world-space placement rather than stretching old content to fill the new viewport. The first subsequent draft render repaints fully. During `ending`, backing resize preserves the completed visible frame until tile handoff finishes.

## Image leases

`packages/splat/src/shapes/rasterImageCache.ts` deduplicates pending loads by source. Pipeline owners retain image sources from the current document; asynchronous exports retain their captured document's assets independently. Releasing one owner must not evict another owner's images. Releasing the final lease removes that owned asset; unowned warm entries have a separate least-recently-used budget.

The current unused budget is 32 entries and approximately 32 MiB, estimated from RGBA dimensions plus source-string size. Active owners are exempt: evicting visible assets would cause a load/invalidate/reload loop. Failure bookkeeping is bounded; a failed source becomes eligible for retry on lookup after five seconds. This is not an automatic retry timer.

Late callbacks verify that their image is still the cache entry. Eviction detaches handlers. The pipeline removes its deferred-image listener and releases its lease on disposal. Source data retained by documents or undo history is separate from this decoded-image cache.

## Async safety rule

For each asynchronous operation, identify the owner, what makes its result stale, and who releases its resources. Test cancellation, document switching and disposal while that operation is pending. A final identity check prevents stale publication; an earlier check can also prevent expensive work that no current consumer can use.
