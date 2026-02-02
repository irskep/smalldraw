# Handle-Based Interactions

Handles let a tool expose interactive points (resize, rotate, move) while keeping hit-testing and rendering in the UI layer. This guide shows how to emit handles, interpret handle behavior, and integrate pointer drags.

If you have not read it yet, start with [Tool Runtime Model](../explanation/tool-runtime-model.md).

## How Handles Work

- The tool **emits** handle descriptors through `runtime.emit({ type: 'handles', payload })`.
- The UI **renders** the handles and sets `handleId` on pointer events when a handle is hit.
- The tool **reads** `event.handleId` to decide what to do.

A handle descriptor uses normalized coordinates (`u`, `v`) inside the selection bounds:

```typescript
export interface HandleDescriptor {
  id: string;
  position: { u: number; v: number };
  behavior: HandleBehavior;
  altBehavior?: HandleBehavior;
  shiftBehavior?: HandleBehavior;
}
```

`u = 0, v = 0` is top-left, `u = 1, v = 1` is bottom-right, and `u = 0.5, v = 0.5` is center.

## Emitting Handles

This snippet adds a rotate handle above the shape and four corner resize handles.

```typescript
import type { HandleDescriptor, ToolDefinition } from "@smalldraw/core";

const HANDLES: HandleDescriptor[] = [
  { id: "top-left", position: { u: 0, v: 0 }, behavior: { type: "resize" } },
  { id: "top-right", position: { u: 1, v: 0 }, behavior: { type: "resize" } },
  { id: "bottom-left", position: { u: 0, v: 1 }, behavior: { type: "resize" } },
  {
    id: "bottom-right",
    position: { u: 1, v: 1 },
    behavior: { type: "resize" },
  },
  { id: "rotate", position: { u: 0.5, v: -0.2 }, behavior: { type: "rotate" } },
];

export function createHandleDemoTool(): ToolDefinition {
  return {
    id: "handle-demo",
    label: "Handle Demo",
    activate(runtime) {
      runtime.emit({ type: "handles", payload: HANDLES });

      return () => {
        runtime.emit({ type: "handles", payload: [] });
        runtime.emit({
          type: "handle-hover",
          payload: { handleId: null, behavior: null },
        });
      };
    },
  };
}
```

## Driving Behavior With `handleId`

Your UI should pass the handle id into pointer events (see the vanilla UI for an example in `packages/ui-vanillajs`). In the tool, always resolve behavior from the handle descriptor so modifiers go through `altBehavior` and `shiftBehavior`.

```typescript
import { createPointerDragHandler, type HandleBehavior } from "@smalldraw/core";

function resolveBehavior(
  handleId: string,
  shiftKey?: boolean,
  altKey?: boolean
): HandleBehavior | null {
  const descriptor = HANDLES.find((handle) => handle.id === handleId);
  if (!descriptor) return null;
  if (shiftKey && descriptor.shiftBehavior) return descriptor.shiftBehavior;
  if (altKey && descriptor.altBehavior) return descriptor.altBehavior;
  return descriptor.behavior ?? null;
}

export function createHandleDemoTool(): ToolDefinition {
  let disposeDrag: (() => void) | null = null;
  return {
    id: "handle-demo",
    label: "Handle Demo",
    activate(runtime) {
      runtime.emit({ type: "handles", payload: HANDLES });
      disposeDrag?.();
      disposeDrag = createPointerDragHandler(runtime, {
        onStart(point, event) {
          if (!event.handleId) return null;
          const behavior = resolveBehavior(
            event.handleId,
            event.shiftKey,
            event.altKey
          );
          if (!behavior) return null;
          runtime.emit({
            type: "handle-hover",
            payload: { handleId: event.handleId, behavior },
          });
          return { behavior, start: point };
        },
        onMove(state, point) {
          // Update draft shapes based on state.behavior and drag distance.
          // Use runtime.setDraft() for live previews.
          void point;
        },
        onEnd(state) {
          // Commit the action based on state.behavior.
          void state;
        },
        onCancel() {
          runtime.emit({
            type: "handle-hover",
            payload: { handleId: null, behavior: null },
          });
          runtime.clearDraft();
        },
      });

      return () => {
        disposeDrag?.();
        disposeDrag = null;
        runtime.emit({ type: "handles", payload: [] });
        runtime.emit({
          type: "handle-hover",
          payload: { handleId: null, behavior: null },
        });
        runtime.clearDraft();
      };
    },
  };
}
```

## Coordinate Space Notes

Handle positions are expressed in **selection bounds**, not raw geometry. Your UI should calculate bounds (using `getShapeBounds(shape, registry)` for each selected shape) and then place handles using the `u/v` interpolation. Use `store.getShapeHandlers()` or `runtime.getShapeHandlers()` for the registry.

If a shape is rotated, you can still place handles in bounds space but adjust rendering to rotate the handles if you want axis-aligned behavior. The vanilla UI does this for axis handles in `SelectionOverlay`.