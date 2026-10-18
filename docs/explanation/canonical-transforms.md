# Canonical transforms

The model's transform contract is in `packages/core/src/model/shape.ts`. Translation, scale and origin are vector tuples; rotation is in radians. Normalization supplies translation/origin `[0, 0]`, scale `[1, 1]`, and rotation `0` when omitted.

## Coordinate convention

Committed shapes normally use geometry centered around a local origin and translation for their world-space center. The renderer applies `T(translation) × R(rotation) × S(scale) × T(-origin)`. Nonzero origins, reflected scales and nonuniform scales must be respected by bounds and painting alike.

For an untransformed stroke from `[100, 100]` to `[200, 150]`, a centered representation has local endpoints `[-50, -25]` and `[50, 25]`, with translation `[150, 125]`.

## Handler-owned canonicalization

`canonicalizeShape` normalizes the transform and default layer, then asks the registered shape handler for geometry bounds/canonicalization. Shapes without a canonicalizer retain their geometry. Concrete handlers are responsible for the representation they support; do not assume a generic rewrite of arbitrary already-transformed geometry is harmless.

New stroke tools may construct drafts in document coordinates with an identity transform and construct centered committed geometry at completion. The important contract is that both representations paint the intended world-space shape. Use existing action/handler helpers and tests rather than adding a second centering convention.

## Changes requiring extra care

- Re-centering already rotated/scaled geometry.
- Bounds used for tile filtering versus selection/hit testing.
- Origin offsets in image/stamp shapes.
- Old/new footprints when geometry or transform changes.
- Immutable shape identity used by bounds caches.

See [local geometry and bounds](geometry-local-space.md) and [rendering validation](../guides/rendering-validation.md).
