# Tool runtime model

A tool defines an `id`, a label, optional style support, and `activate(runtime)`. Activation registers handlers and may return a disposer. The exact interfaces are in `packages/core/src/tools/types.ts`; runtime behavior is in `tools/runtime.ts` and `store/drawingStore.ts`.

## Runtime capabilities

| Capability | API | Ownership |
| --- | --- | --- |
| Input | `on`, or `attachPointerHandlers` | Handlers must be disposed on deactivation |
| Temporary geometry | `setDraft`, `setDrafts`, `clearDraft` | Local interaction only |
| Paint hints | `setPreview`, `getPreview` | Conservative dirty bounds, consumed by rendering |
| Document mutation | `commit` with an undoable action | Store/adapter owns application and history |
| Layer/order | `getActiveLayerId`, `getNextZIndexInLayer` | Capture the intended layer for the interaction |
| Settings | `getSharedSettings`, `updateSharedSettings`, `getOptions` | Host configuration and shared drawing choices |
| Persistent tool preferences | `getToolState`, `setToolState`, `updateToolState` | Survive tool activation changes within the store |
| Selection and handles | Selection helpers, `emit`, `onEvent` | Transient editor interaction state |
| Read model | `getDocument`, `getShape`, `getOrderedShapes`, `getShapeHandlers` | Read current committed state; mutate through actions |

The tool runtime is a capability interface, not a security sandbox. Concrete fill tools use canvas APIs in `splat`; generic core tool contracts do not require a DOM.

## Input and rendering are different clocks

Browser input is adapted by `packages/splat/src/controller/createInputSessionController.ts`. Tools receive document-space `Vec2` points, button state, optional pressure/modifiers, and optional handle identity. They do not need raw browser pointer events.

A batch of input can publish several draft updates before a frame is rendered. Keep input updates cheap and preserve the latest geometry. Do not assume one move equals one canvas paint or one network operation.

`setPreview` supplies a paint-region hint. If a tool cannot prove conservative dirty bounds, a full repaint is safer than dropping changed pixels. The renderer remains responsible for world-to-backing conversion and clipping.

## Activation and cancellation

Tool deactivation must stop producers as well as remove consumers: dispose event subscriptions, stop spray animation callbacks, clear draft/preview state, and discard any unfinished interaction. Persistent preferences are separate from an active stroke.

The store resets the active tool when its layer disappears. This uses the same cleanup contract to prevent orphan commits and timer-driven draft resurrection. Tests should send pointer-up after cancellation to verify that it cannot commit stale state.

See [draft shapes](draft-shapes.md), [tool paths](tool-rendering-paths.md), and [the implementation guide](../guides/creating-a-drawing-tool.md).
