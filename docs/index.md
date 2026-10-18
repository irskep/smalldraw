# Internal documentation

These docs explain the implementation of Splatterboard and its Smalldraw packages. Start with the architecture map, then follow one stroke through the renderer before changing a hot path.

## Reading order

1. [Architecture overview](explanation/architecture-overview.md): package boundaries and the two kinds of state.
2. [Rendering pipeline](explanation/rendering-pipeline.md): committed tiles, frozen snapshots, active scratch, and handoff.
3. [Tool rendering paths](explanation/tool-rendering-paths.md): where marker, pen, spray, eraser, shapes, stamps, and fill differ.
4. [Draft shapes](explanation/draft-shapes.md): tool drafts versus renderer sessions.
5. [Cache ownership](explanation/rendering-cache-ownership.md): lifetimes, invalidation, images, and asynchronous work.
6. [Multiplayer lifecycle](explanation/multiplayer/lifecycle.md): convergence, frozen display, cancellation, switching, and reconnects.
7. [Rendering validation](guides/rendering-validation.md): measurements, regression evidence, and changes requiring experiments.

## Working on the code

- [Development](guides/development.md)
- [Tool runtime](explanation/tool-runtime-model.md)
- [Creating a drawing tool](guides/creating-a-drawing-tool.md)
- [Tool state and shared settings](guides/tool-state-and-settings.md)
- [Actions and undo](explanation/action-and-undo-system.md)
- [Canonical transforms](explanation/canonical-transforms.md) and [local geometry](explanation/geometry-local-space.md)
- [Multiplayer and document identity](explanation/multiplayer/index.md)
- [API reference](api.md)

## Documentation status

The rendering explanations were checked against source during the October 2026 audit. They distinguish implementation facts, measured results, and open investigations. Source paths are relative to the repository root unless a link says otherwise.

`docs/thinking/`, `docs/region-based-applydocument-dirtying/`, root lab notebooks, and older proposal files preserve design history. Do not use an unchecked box there as proof that a bug still exists. The uncommitted `scratch/rendering-audit.md` contains the detailed investigation log; the durable conclusions are summarized here.

Account-workspace behavior is being revised concurrently with this documentation pass. The multiplayer overview identifies the relevant code, but detailed migration and account-wide synchronization policy should be checked against the current implementation rather than inferred from the older sharing plans.
