# Geometry, bounds and coordinate spaces

The pipeline uses local geometry, document/world coordinates, and canvas backing pixels. Mixing these can produce bugs that appear only at a different DPR, viewport size or shape transform.

| Space | Meaning | Examples |
| --- | --- | --- |
| Shape local | Coordinates before the shape transform | Centered pen points, boxed geometry, stamp placement data |
| Document/world | Drawing coordinates after the shape transform | Tool input, shape dirty bounds, layer composition |
| Canvas backing | Physical raster coordinates | DPR-scaled tile/hot canvases and clip rectangles |

Use `Vec2`, `BoxOperations` and the transform helpers rather than copying scalar coordinate arithmetic between layers. The shape renderer and bounds calculation must apply the same transform, including origin, rotation and nonuniform/reflected scale.

## Bounds have purposes

A handler's local geometry bounds, selection bounds and conservative paint bounds are not interchangeable. Thick strokes, smoothing, joins and antialiasing can extend beyond the raw point box. `tileShapeFilter.ts` deliberately adds conservative stroke padding and includes shapes with unknown bounds instead of incorrectly excluding them.

`processApplyDocumentDiff.ts` uses previous and next snapshots to dirty old and new footprints. Clearing only the new location leaves stale pixels. Changing a layer or z-order may require broader invalidation than the shape's new box.

## Snapshot extent versus resolution

A frozen snapshot records its logical width/height. Its backing pixels are sampled at a resolution, but changing DPR or viewport must not relocate or stretch the captured drawing. `HotLayer` converts the captured extent into the current backing size; the pipeline forces a full repaint after viewport changes.

For the exact shape transform convention, see [canonical transforms](canonical-transforms.md). For partial repaint and pixel-comparison limits, see [rendering validation](../guides/rendering-validation.md).
