# @smalldraw/core

Core owns drawing documents, shape-handler contracts, actions/undo, the tool runtime, the drawing store, and the Automerge store adapter. It does not own DOM presentation or concrete Splatterboard raster tools.

## Source map

| Area | Location |
| --- | --- |
| Document and layers | `src/model/document.ts` |
| Shape and transform contract | `src/model/shape.ts` |
| Shape handlers | `src/model/shapeHandlers.ts` |
| Pen encoding and preview decoding | `src/model/penStroke.ts` |
| Actions | `src/actions/` |
| Local undo history | `src/undo.ts` |
| Tool interfaces and runtime | `src/tools/types.ts`, `src/tools/runtime.ts` |
| Store and external snapshot diffing | `src/store/drawingStore.ts`, `src/store/diffDocumentShapes.ts` |
| Repo adapter | `src/automerge/storeAdapter.ts` |

Concrete marker, pen, spray, fill and stamp implementations live in `packages/splat/src/tools/`. Selection and shared interaction helpers live here. Canvas execution lives in the renderer packages and the application's registered shape renderers.

See the maintained explanations:

- [Architecture](../../docs/explanation/architecture-overview.md)
- [Tool runtime](../../docs/explanation/tool-runtime-model.md)
- [Actions and undo](../../docs/explanation/action-and-undo-system.md)
- [Drafts](../../docs/explanation/draft-shapes.md)
- [Creating a tool](../../docs/guides/creating-a-drawing-tool.md)

Committed snapshots are treated as immutable by diffing and derived caches. Use actions and adapter transactions for changes. Temporary drafts remain outside the document and outside local undo history.
