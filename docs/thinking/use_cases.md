# Vision

Smalldraw (to be renamed) is a construction kit for drawing apps.

- A scalable data model that supports optional multiplayer
- Renderers for common shapes
- Batteries-included tools that solve the hardest problems so you can focus on the problems in a specific domain
- Complete UIs so you can just "drop a drawing program" into any web app

My previous forays into this space were Literally Canvas (2012, abandoned) and Browserboard (2020, sold off and now shut down but info possibly still available). The first was a way to write simple single-<canvas> drawing programs, the latter was an infinite whiteboard.

# Potential use cases and their requirements

## Kid Pix

- Raster-style drawing
- Raster-style selection tool
- Eraser tool
- Image export

## Infinite whiteboard

- Rich viewport: space to move, scroll wheel to zoom while maintaining center
- DOM-based layers, for good text and SVGs
- Solid-as-a-rock selection tool
- Images, PDFs
- Image export

## skribbl.io-style games

- Live pen stroke drafts
- Eraser tool

## Icon editor

- Vector paths
- SVG output

# Viewport modes

- A: "Painting": locked to an aspect ratio with no pan/zoom
- B: "Photoshop": Canvas is bounded and has a default view, but can pan/zoom
- C: "Infinite": has a default viewport, but otherwise completely unconstrained, likely fullscreen

# Mixing vector and raster

Conceptually, a line can be drawn in vector space, or in pixels.

If drawn in pixels, then when you zoom in/out, the line gets blurry, or has resize artifacts. This is a bad fit for infinite whiteboards.

But if a line is drawn as a vector, then it can't be affected by an eraser tool. This is a bad fit for Kid Pix or Photoshop-style apps.

So, in Smalldraw, when you draw a shape such as a line, I want it to be configurable what happens, by creating three distinct tools with different behaviors:

1. The line is a vector ("infinite canvas")
2. The line goes onto its own canvas ("photoshop")
3. The line gones into an existing canvas ("painting")

This complicates the data storage story. Currently, the data model is a map of shapes with z-indices. If we are to introduce the idea of raster canvases, a few things need to happen.

- Shapes need to be groupable into canvases with local coordinates and z-ordering
- We probably need multiple Konva renderers and to use a DOM hierarchy to show the renderers. Or maybe a "canvas layer" and a "vector layer" above it? That might work...but if we do that, might as well have the data model support arbitrary layers.
- Since the entire app is built on automerge, if two people draw to a canvas but one has a conflict requiring replay, then we will need to reconstruct the canvas somehow. I think Konva makes this reasonable to do. This also has affects on undo/redo. We don't want to store bitmaps of the entire history of the canvas just so we can undo. It might be computationally expensive to remain memory efficient.

So suppose we do the following.

There is a "layers" abstraction. Infinite-canvas behavior is that every shape goes into its own layer. The layer owns the transform, so the shape is always at 0,0 within its layer.

Layers are stored as a map, just like shapes. {[id]: {layer object}}

Canvases are also stored as a map. { [id]: { layerId, size: [w, h] }}

Shapes either have a layerId property, or a canvasId property. Layers do not have references the other way in the data model, though we may wish to maintain a reverse lookup map at runtime.

This setup would let me support SVG export by rasterizing canvases and including them in the SVG as base64 images, rather than ignoring erasers entirely (a strategy I've used in previous projects) or trying to do complex geometry intersections on arbitrary paths.

# Commentary on erasers

Children expect erasers to erase like physical erasers, not delete entire objects. This is a problem for "infinite whiteboard" applications because adults using digital whiteboards expect to be able to move objects around.

I solved this problem in Browserboard by having every shape on its own canvas, and have a private "eraser stack" which replicated the eraser in local coordinate space. So if you erase half a rectangle and move it, the local eraser moves with it, and the shape of the rectangle doesn't change.

In hindsight I don't think that's the right way to resolve the tension. Having explicit raster canvas objects will satisfy the kids, who will usually be drawing in raster mode anyway. In Smalldraw, erasers will always be tied to canvas objects.

I suppose one way to handle the "mixed" scenario would be to convert vector shapes to raster + canvas iff an eraser tool is used on them.

# Commentary on scale

On infinite whiteboards, people often zoom in and out, and draw at those scales. Zoomed in, it's important to capture input with proportional granularity because if you capture whole pixels, you basically can't draw fine shapes close up. On the other hand, zoomed way out, you should still capture input and render at the proportional scale, because otherwise you might try to render a 10 million pixel wide canvas, which the graphics system can't handle.

In Browserboard, I solved this nicely by having every shape capture the scale it was created at, so you could do everything in screen space. So if you zoom to 0.5x and draw a line from -50, -50 to 50, 50 in screen space, and then zoomed back in, the line would look a little blurry because it's rendering at 2x. Blur is a bummer, but drawing at arbitrary scales is better.

In Smalldraw I haven't explored this area yet because I'm not sure how well Konva handles this scenario natively.

# Open questions

- How does one implement a raster eraser in Konva? Suppose I add an image to the drawing and a canvas above it. How would I implement the ability to draw over the image such that the eraser reveals the image rather than erasing it?
- How does Konva handle extremely large or extremely small shapes?
- Given the answers to the above questions, do I need to drop Konva and do my own canvas/DOM thing?
- Does the use of Konva limit what I can do with text? (Likely yes, since HTML canvas limits what you can do with text)