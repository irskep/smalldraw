# @smalldraw/core

`@smalldraw/core` provides the data model, action system, undo/redo, and tool runtime that power Smalldraw’s drawing experience. This package is deliberately UI-agnostic: React/Konva integrations live in other packages, while this module focuses on describing shapes, mutating documents, and orchestrating tool behavior.

## Data Model

Documents are collections of `Shape` objects indexed by id. Every shape shares the following concepts:

- **Geometry** – A discriminated union covering rectangles, ellipses, regular polygons, arbitrary polygons, pen strokes, paths, and beziers. Geometry describes local-space data only (e.g., pen points relative to the shape’s center).
- **Transform** – Each shape has a canonical transform with translation (world-space center), rotation, scale, and origin. Canonicalization runs whenever shapes enter the document so tools can assume translations are always centered and origins default to (0,0).
- **Interactions** – Flags for behaviors such as `resizable` and `rotatable`. Tools use these to decide which handles to expose or which adapters to invoke.
- **Style** – Optional `Fill`, `StrokeStyle`, and opacity fields. The model does not dictate rendering; it simply records stylistic intent.

Bounds calculations live in `model/geometryBounds.ts`. They derive axis-aligned bounding boxes from geometry + transform and account for stroke width, so selection handles and hit testing have accurate footprints.

## Actions and Undo

Mutations occur through `UndoableAction` objects. Key actions include `AddShape`, `DeleteShape`, `UpdateShapeGeometry`, `UpdateShapeTransform`, and `CompositeAction`. Actions:

- Operate on a shared `DrawingDocument` and record previous state to enable undo/redo.
- Canonicalize shapes as needed (e.g., `AddShape` runs `canonicalizeShape`, `UpdateShapeGeometry` re-centers point arrays) so downstream code always interacts with normalized data.
- Compose via `CompositeAction` when multi-shape operations should be undone as a unit.

`UndoManager` applies actions to documents, maintains undo/redo stacks, and reports capabilities via `canUndo`/`canRedo`.

## Tool Runtime

`ToolRuntimeImpl` is the bridge between tools and documents. It provides:

- Event subscription (`pointerDown`/`Move`/`Up`/`Cancel` and custom events via `emit/onEvent`).
- Draft shape management for in-progress strokes or rectangles.
- Shared tool settings (colors, widths) and per-tool state storage.
- Selection helpers (`getSelection`, `setSelection`, toggling) shared among tools.
- Undo action committing (`commit`) and id/z-index generation.

`DrawingStore` wires runtimes together, keeps a single document/undo manager, tracks active tool handles and hover states, and now exposes live selection-frame bounds for UI consumers.

## Tools

Tools are declarative modules implementing `ToolDefinition`. Core tools include:

- **Pen** – Collects pointer points, writes local-space pen geometry, and marks strokes as resizable. Draft updates and final commits share a helper to ensure consistent canonicalization.
- **Rectangle** – Drags out center/size data from two points, writes canonical transforms, and flags rectangles as rotatable/resizable.
- **Selection** – Manages selection state, emits handle metadata/hover events, responds to pointer drags for move/resize/rotate, and broadcasts live selection frames. It drives shape resizing via adapters.

### Pointer Drag Controller

`pointerDrag.ts` provides `createPointerDragHandler`, a reusable helper that wires pointerDown/move/up/cancel to tool-specific callbacks. Tools can rely on this controller to maintain drag lifecycles without re-implementing event plumbing, reducing the chance of inconsistent cleanup. Selection currently uses this controller; other tools can adopt it to standardize behavior further.

### Selection Handles & Adapters

Selection exposes a fixed set of handles (corners + rotate). Hover behavior is resolved per handle with modifier-aware descriptors, keeping UI feedback consistent. During drags, selection:

1. Takes snapshots of each selected shape (transform, geometry, normalized layout).
2. Delegates resize logic to adapters registered per geometry type (rectangles, ellipses, regular polygons, pen strokes). Each adapter receives the snapshot data, selection-frame scale, and layout offsets, and returns geometry or transform updates to apply.
3. Falls back to translation-only transforms for shapes without adapters or non-resizable interactions, preserving relative positions.

Adapters are easy to extend: define `matches`, `prepare` (snapshot), and `resize`. The tests in `resizeAdapters.test.ts` ensure the documented geometry types stay in sync with the registry.

### Selection Frames

The selection tool recomputes bounding boxes during drags and emits `selection-frame` events through the runtime. The store subscribes to these and exposes a getter so UI layers can render transient frames, snapping guides, or overlays without duplicating math.

## Canonicalization and Local Space

All point-based geometries (pen, stroke, polygon, path, bezier) are stored in local space relative to their bounding-box center. When shapes enter the document or update geometry, `canonicalizeShape` recenters points and updates the transform translation accordingly. This guarantees downstream code (renderers, adapters, bounds) can assume geometry is local and transforms carry the world-space position.

## Testing Philosophy

The core package ships comprehensive tests covering:

- Geometry actions, ensuring canonicalization and undo/redo behave as expected.
- Tool runtimes (pen, rectangle, selection) including drafts, commits, handle hover behavior, selection-frame events, and adapter-driven resize flows.
- Store behavior, verifying tool activation, shared settings, selection propagation, handle updates, and selection-frame getters.
- Adapter coverage via `resizeAdapters.test.ts` to prevent regressions when adding new geometry types.

This suite minimizes the need to inspect implementation details; if a change alters canonicalization, selection frames, or adapter behavior, tests highlight the deviation immediately.

## Extending the Core

When adding a new geometry or tool:

1. Update `model/geometry.ts` and implement canonicalization logic if the geometry contains local-space coordinates.
2. Add a resize adapter (or explicitly opt out) and extend the adapter tests.
3. Hook the geometry into tools or action creators using the existing Abstract APIs: add shapes via `AddShape`, adjust geometry via `UpdateShapeGeometry`, and leverage the pointer drag controller for interactive tools.
4. Extend bounds/tests if the geometry needs custom padding or selection behavior.

By adhering to canonical transforms, adapter contracts, and the pointer drag infrastructure, new components integrate cleanly with selection, undo, and future UI layers without requiring deep knowledge of every file.
