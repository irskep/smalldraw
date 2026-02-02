# Creating a Drawing Tool

You want a tool that reacts to pointer events, shows a draft preview, and commits a shape when the interaction ends. This guide walks you through the smallest complete implementation and highlights the lifecycle details you must handle.

If you have not read it yet, start with [Tool Runtime Model](../explanation/tool-runtime-model.md) so the API names make sense.

## Minimal Tool Structure

A tool is a `ToolDefinition` with an `activate()` function. Use `activate()` to register runtime handlers, and return a function from `activate()` to clean up.

```typescript
import type { ToolDefinition, ToolRuntime } from "@smalldraw/core";

export function createStampTool(): ToolDefinition {
  return {
    id: "stamp",
    label: "Stamp",
    activate(runtime: ToolRuntime) {
      // Register handlers here.
      return () => {
        // Remove handlers and clear drafts here.
      };
    },
  };
}
```

## A Complete Example (Stamp Rectangle)

This tool places a fixed-size rectangle on click, but still shows a draft preview while the pointer is down. It uses `attachPointerHandlers()` to wire events and `AddShape` to commit the final shape.

```typescript
import {
  AddShape,
  attachPointerHandlers,
  type Point,
  type Shape,
  type ToolDefinition,
  type ToolRuntime,
} from "@smalldraw/core";

interface StampState {
  disposers: Array<() => void>;
  draftId?: string;
}

const stateMap = new WeakMap<ToolRuntime, StampState>();

function ensureState(runtime: ToolRuntime): StampState {
  let state = stateMap.get(runtime);
  if (!state) {
    state = { disposers: [] };
    stateMap.set(runtime, state);
  }
  return state;
}

function buildRectShape(id: string, point: Point, runtime: ToolRuntime): Shape {
  return {
    id,
    geometry: {
      type: "rect",
      size: { width: 120, height: 80 },
    },
    stroke: {
      type: "brush",
      color: runtime.getSharedSettings().strokeColor,
      size: runtime.getSharedSettings().strokeWidth,
    },
    fill: {
      type: "solid",
      color: runtime.getSharedSettings().fillColor,
    },
    zIndex: runtime.getNextZIndex(),
    interactions: { resizable: true, rotatable: true },
    transform: {
      translation: point,
      rotation: 0,
      scale: { x: 1, y: 1 },
    },
  };
}

export function createStampTool(): ToolDefinition {
  return {
    id: "stamp",
    label: "Stamp",
    activate(runtime) {
      const state = ensureState(runtime);
      state.disposers.forEach((dispose) => dispose());
      state.disposers = [];
      state.draftId = undefined;

      const dispose = attachPointerHandlers(runtime, {
        onPointerDown: (event) => {
          const draftId = runtime.generateShapeId("stamp-draft");
          state.draftId = draftId;
          runtime.setDraft({
            ...buildRectShape(draftId, event.point, runtime),
            toolId: runtime.toolId,
            temporary: true,
          });
        },
        onPointerMove: (event) => {
          if (!state.draftId) return;
          runtime.setDraft({
            ...buildRectShape(state.draftId, event.point, runtime),
            toolId: runtime.toolId,
            temporary: true,
          });
        },
        onPointerUp: (event) => {
          if (!state.draftId) return;
          const shapeId = runtime.generateShapeId("stamp");
          const shape = buildRectShape(shapeId, event.point, runtime);
          runtime.commit(new AddShape(shape));
          runtime.clearDraft();
          state.draftId = undefined;
        },
        onPointerCancel: () => {
          runtime.clearDraft();
          state.draftId = undefined;
        },
      });

      state.disposers.push(dispose);

      return () => {
        const state = ensureState(runtime);
        state.disposers.forEach((dispose) => dispose());
        state.disposers = [];
        state.draftId = undefined;
        runtime.clearDraft();
      };
    },
  };
}
```

### Why this works

- **Drafts are per tool.** You must set `toolId` and `temporary: true` when calling `runtime.setDraft()`.
- **Commit through actions.** `AddShape` lets the undo system track changes.
- **Cleanup matters.** The tool owns its handlers and drafts. Remove handlers on deactivation and clear drafts on cancel.

## Event Lifecycle Notes

A typical tool flow is:

1. `pointerDown` creates initial draft
2. `pointerMove` updates the draft
3. `pointerUp` commits and clears
4. `pointerCancel` clears without commit

Keep this lifecycle consistent so the selection tool and undo manager behave predictably.

## Tips

- If you need drag semantics instead of raw handlers, use `createPointerDragHandler()`.
- If you need multiple drafts at once (e.g., alignment guides), use `runtime.setDrafts()`.
- Read the existing tool implementations in `packages/core/src/tools` for patterns.