## Infinite Kid Pix Design Overview

### Goals and framing

This prototype is built around one goal: kids should be able to scribble with abandon without the UI feeling heavy. That means the fast path is always local, always raster, and always cheap. The canonical data model still matters because we want selection, move, resize, and multiplayer to be correct over time, but the rendering path must never depend on expensive document operations.

The authoritative state is a shared shape model designed for long‑term correctness. Shapes carry geometry, style, transform, and ordering data. This model is the source of truth for replays, editing tools, and future features. It is deliberately decoupled from rendering so that we can change render strategies without breaking the model. Multiplayer synchronization operates on this shape data only.

### Rendering strategy

The rendering system is split into a hot layer and a tile cache. The hot layer is a local canvas that receives active input and is updated on every pointer move. It is screen‑space and intentionally ephemeral. The tile cache is a grid of world‑space tiles at a fixed size of 1024 by 1024, created only when visible. The hot layer gives instantaneous feedback; the tile cache provides stability and bounded memory as the canvas grows.

Committed shapes are baked into tiles asynchronously, after input ends. This keeps the input loop light while still ensuring the world is updated promptly. It also allows later tools to operate on stable tiles rather than on live stroke data. We intentionally avoid live remote drafts for now. When a remote shape arrives, it is committed to the document and then baked into tiles just like a local shape, which keeps the system consistent and predictable.

### Tile cache and invalidation

Tile caching is local only. Tiles are derived from the document and are not shared across clients. This keeps storage simple and avoids the complexity of distributed cache invalidation. It also lets each device make its own tradeoffs about how aggressively to rebuild tiles.

Tile invalidation uses a per‑shape record of which tiles it has touched since the last bake. Each shape maintains a local set of covered tiles since the most recent successful bake. When a shape changes, we add the tiles it intersects to that set. Any tile in that set is invalidated and scheduled for rebuild. This guarantees that if a shape moves away from a tile, that tile is still rebuilt promptly and correctly. The set is local state, not part of the shared document, which keeps the CRDT small and avoids synchronization cost.

We chose this approach over storing a full spatial index or long‑term shape history in the document. A spatial index can be added later as a pure optimization if drawings grow beyond a handful of tiles. Long‑term history is unnecessary because we only need correctness since the last bake, not forever.

### Input and strokes

Pen strokes are committed as complete shapes after the user finishes drawing. We do not stream append‑point updates into the shared document. This keeps CRDT updates coarse and efficient on iPad. If we later need live instructional drawing, we can add a separate ephemeral channel that publishes draft points without touching the canonical document.

### Tools and roadmap choices

Some tools are intentionally deferred but planned. A bitmap lasso tool can be supported by creating a raster stamp shape whose payload is the selected pixels. This is a pragmatic choice that trades storage size for simplicity and correct rendering. Vector extraction or stroke‑level manipulation is deliberately out of scope for the prototype.

### Tradeoffs and next steps

The design is opinionated about tradeoffs. We accept slight over‑rendering in exchange for simpler invalidation. We accept locally derived caches to keep the shared model small. We accept temporary blurriness when zooming, because infinite zoom is not a requirement. These decisions optimize for a responsive, kid‑friendly experience on iPad while leaving a path to more advanced editing and collaboration later.

Next steps are focused on implementation clarity rather than new features. The immediate priorities are solidifying the shape model, enforcing the hot layer and tile separation, and wiring the invalidation path so tiles rebuild reliably without touching the input loop. Once that is stable, we can explore optional live draft streaming and more advanced tools.

### Appendix notes

We remain bullish on Automerge for this project because multiplayer is not a bolt‑on feature here. The long‑term goal is a reusable model for multiple applications, and a CRDT gives a durable foundation even if the prototype trades some performance headroom to get there.

Tile invalidation does not need to be synchronized across peers because tiles are explicitly local and derived. Each client rebuilds its own tiles based on the shared document state. This keeps the network and the CRDT clean and predictable.

We considered having shapes remember every tile they ever touched, but settled on a bounded local set of tiles since last bake. That set is enough to guarantee that tiles a shape recently left are rebuilt promptly, without unbounded growth or extra CRDT overhead.
