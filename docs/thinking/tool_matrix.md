> Historical design/work notes. Claims about “current” behavior and unchecked tasks refer to the original investigation, not a verified present-day backlog. Start with the [maintained internal docs](../index.md).

Tools in Splatterboard can have multiple modes.

Planned modes:
- Multi-color: rainbow, or recent color picker history determines output
- Canvas is actively spinning (this probably only does transforms at the pointer level, so tools won't need specific implementations)
- Multiple "crazy" modes per tool

Current modes:
- Coloring page vs not coloring page

Each tool needs to define how it works in each mode.

Brush
- Coloring: Underneath

Eraser:
- Affects things drawn both over and under the coloring page, but leaves the coloring page itself intact
  - ...except there's a crazy mode (later) where it also erases the coloring page

Fill
- Coloring: Underneath, but respects lines in fill algorithm

Shapes:
- Coloring: Underneath

Stamps:
- Coloring: ON TOP! Stamps will eventually be renamed Stickers, which are put _on_ paper.
