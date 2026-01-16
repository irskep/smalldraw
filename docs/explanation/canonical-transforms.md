# Canonical Transforms

Every shape has a transform that positions it in the document. The transform system uses a specific convention—canonical form—that makes rotation and scaling predictable.

## The Transform Structure

A shape transform has four components:

- **translation** — the shape's center point in world coordinates
- **rotation** — angle in radians
- **scale** — x and y scale factors
- **origin** — the local point that translation refers to (usually 0,0)

## Center-Based Positioning

The key convention: **translation stores the center of the shape, not the top-left corner**.

Most graphics systems position shapes by their top-left. Smalldraw positions by the center. This matters because rotation happens around the translation point.

A shape positioned by its top-left swings in an arc when rotated. A shape positioned by its center spins in place.

## What Canonicalization Does

When a shape enters the document, it gets *canonicalized* to follow the center-based convention.

For rectangles and ellipses, the center is implicit. A 100x50 rectangle is centered at (0,0) in local space by definition.

For point-based geometries, canonicalization shifts the points. If you draw a stroke from (100, 100) to (200, 150):

1. Compute the bounding box center: (150, 125)
2. Shift points to be relative to center: (-50, -25) to (50, 25)
3. Add the offset to translation: (150, 125)

The shape appears in the same place, but points are now in local space and translation holds the world position.

## Why This Matters

Canonical form simplifies the math for:

**Rotation.** Just change the angle. No pivot offset calculations.

**Scaling.** The shape grows outward uniformly from its center.

**Bounds calculation.** Local bounds plus transform gives world bounds consistently.

**Selection handles.** Dragging a corner to resize keeps the opposite corner fixed.

## Two Coordinate Spaces

**Local space** — relative to the shape's center. A 100x50 rectangle spans (-50, -25) to (50, 25).

**World space** — in the document. Apply the transform to convert local to world.

The renderer draws in local space, then the transform positions it. Selection and hit-testing work in world space.

## Which Shapes Get Canonicalized

| Geometry | Canonicalized? | Reason |
|----------|---------------|--------|
| rect, ellipse, regularPolygon | No | Center is implicit |
| pen, stroke, polygon | Yes | Points need recentering |
| path, bezier | Yes | Points and handles need recentering |

The `AddShape` action canonicalizes automatically.
