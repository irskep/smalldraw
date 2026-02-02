# Tool State and Shared Settings

Tools need two kinds of state:

- **Tool state** for per-tool persistence (brush size, last mode, active subtool).
- **Shared settings** for cross-tool defaults (stroke color, fill color).

This guide shows when and how to use each.

## Tool State: Per-Tool Memory

Use `runtime.getToolState()` and `runtime.setToolState()` to persist tool-specific values across activations. This state lives in the `DrawingStore`, so it survives tool switching but not full app reloads.

```typescript
import type { ToolDefinition, ToolRuntime } from "@smalldraw/core";

interface BrushState {
  size: number;
  smoothing: number;
}

const DEFAULT_BRUSH: BrushState = { size: 6, smoothing: 0.5 };

export function createBrushTool(): ToolDefinition {
  return {
    id: "brush",
    label: "Brush",
    activate(runtime: ToolRuntime) {
      const state = runtime.getToolState<BrushState>() ?? DEFAULT_BRUSH;
      runtime.setToolState(state);
      // Use state.size while building strokes.

      // No need to return a function since no cleanup is needed
    },
  };
}
```

### When to update tool state

- **On explicit UI changes.** If your UI has a brush size slider, call `runtime.setToolState()` in the slider handler.
- **On commit.** If you want a tool to remember the last used value after each action, update it after `commit()`.

## Shared Settings: Cross-Tool Defaults

Shared settings are meant for UI-level controls like stroke color and fill color. They are shared across tools.

```typescript
import type { ToolRuntime } from "@smalldraw/core";

function updateStrokeColor(runtime: ToolRuntime, color: string) {
  runtime.updateSharedSettings({ strokeColor: color });
}

function readStroke(runtime: ToolRuntime) {
  const shared = runtime.getSharedSettings();
  return { color: shared.strokeColor, size: shared.strokeWidth };
}
```

### Two common patterns

**Read once on activate.** Use this if you want tools to take a snapshot of the shared settings when you switch to them (stable for a full stroke).

**Read on every event.** Use this if you want changes to apply immediately while dragging (live preview updates).

Pick one pattern and keep it consistent so your UI feels predictable.

## Using Store-Level Settings

If you are building a UI outside the tool runtime (for example, buttons in React), use `DrawingStore` instead of a specific runtime:

```typescript
import type { DrawingStore } from "@smalldraw/core";

function setFill(store: DrawingStore, color: string) {
  store.updateSharedSettings({ fillColor: color });
}
```

The store updates are visible to all tool runtimes and will affect new drafts and actions immediately.