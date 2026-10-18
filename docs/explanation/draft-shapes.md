# Draft shapes

A draft is local visual feedback outside the committed drawing document. Pointer movement changes the draft; committing an action changes the document. Drafts are not persisted, synchronized as shapes, or recorded as intermediate undo entries.

The source contract is `DraftShape` in `packages/core/src/tools/types.ts`: an `AnyShape` plus `toolId` and `temporary: true`. The runtime exposes `setDraft`, `setDrafts`, `clearDraft`, and `setPreview`. Preview dirty bounds are a rendering hint, not geometry stored in the document.

## Tool lifecycle

A typical drawing tool captures settings and the active layer on pointer-down, updates a draft during movement, commits an `AddShape` on pointer-up, and clears on cancellation. Deactivation must dispose handlers/timers and clear transient state. Do not carry an unfinished drag into a later activation just because persistent tool settings survive tool switches.

| Property | Draft | Committed shape |
| --- | --- | --- |
| Document storage and sync | No | Yes |
| Local undo history | No | Through an action |
| Can use temporary preview caches | Yes | Uses committed geometry/rendering contracts |
| Lifetime | Current interaction | Until document mutation removes it |

## Renderer lifecycle is separate

A tool's draft can disappear before the renderer is ready to stop displaying it. The pipeline captures a frozen committed scene, draws the draft against it, and retains the completed visible frame until committed tiles are ready. Its phases are `idle`, `capturing`, `active`, and `ending`.

This is why clearing a runtime draft is not equivalent to clearing the hot canvas immediately. The renderer also needs generation/session guards: a late capture must not revive a cancelled draft, and an old bake completion must not hide a newer stroke.

Remote committed changes can be processed behind the frozen display. If a collaborator deletes the local draft's layer, the stroke is cancelled. Reassigning the draft to another layer would change its meaning.

Read [the rendering pipeline](rendering-pipeline.md) for the surfaces and handoff, and [multiplayer lifecycle](multiplayer/lifecycle.md) for boundary cases.
