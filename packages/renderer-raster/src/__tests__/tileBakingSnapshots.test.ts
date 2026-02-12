import { describe, test } from "bun:test";
import {
  type AnyShape,
  type BoxedGeometry,
  createPenJSONGeometry,
  DrawingStore,
  getDefaultShapeHandlerRegistry,
} from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import {
  renderBoxed,
  renderPen,
  type ShapeRendererRegistry,
} from "@smalldraw/renderer-canvas";
import { createCanvas } from "canvas";
import { TILE_SIZE, TileRenderer, tileKey } from "../index";
import { expectSnapshot } from "./snapshotUtils";

function createTestShapeRendererRegistry(): ShapeRendererRegistry {
  const registry: ShapeRendererRegistry = new Map();
  registry.set("boxed", (ctx, shape) =>
    renderBoxed(
      ctx,
      shape as AnyShape & {
        geometry: {
          type: "boxed";
          kind: "rect" | "ellipse";
          size: [number, number];
        };
      },
    ),
  );
  registry.set("pen", (ctx, shape) =>
    renderPen(ctx, shape as AnyShape & { geometry: { type: "pen-json" } }),
  );
  return registry;
}

const v = (x = 0, y = x): [number, number] => [x, y];
const solidFill = (color: string) => ({ type: "solid" as const, color });

function createViewport(tileCountX: number, tileCountY = 1): Box {
  return {
    min: [0, 0],
    max: [TILE_SIZE * tileCountX, TILE_SIZE * tileCountY],
  };
}

type TileCanvas = ReturnType<typeof createCanvas>;
type CanvasTileRenderer = TileRenderer<TileCanvas>;

const shapeRendererRegistry = createTestShapeRendererRegistry();

function createTileRenderer(shapesRef: { shapes: AnyShape[] }) {
  const registry = getDefaultShapeHandlerRegistry();
  const store = new DrawingStore({ tools: [] });
  const canvases = new Map<string, ReturnType<typeof createCanvas>>();
  const provider = {
    getTileCanvas: (coord: { x: number; y: number }) => {
      const key = tileKey(coord);
      const existing = canvases.get(key);
      if (existing) return existing;
      const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
      canvases.set(key, canvas);
      return canvas;
    },
  };
  const renderer = new TileRenderer<TileCanvas>(store, provider, {
    shapeRendererRegistry,
    shapeHandlers: registry,
    backgroundColor: "#ffffff",
    baker: {
      bakeTile: async (coord, canvas) => {
        const ctx = canvas.getContext(
          "2d",
        ) as unknown as CanvasRenderingContext2D;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-coord.x * TILE_SIZE, -coord.y * TILE_SIZE);
        renderer.renderShapes(ctx, shapesRef.shapes);
        ctx.restore();
      },
    },
  });

  return { renderer, canvases };
}

async function bakeAndSnapshot(
  renderer: CanvasTileRenderer,
  canvases: Map<string, TileCanvas>,
  coord: { x: number; y: number },
  snapshotName: string,
) {
  const canvas = canvases.get(tileKey(coord));
  if (!canvas) {
    throw new Error(`Expected tile canvas for ${coord.x},${coord.y}`);
  }
  await renderer.bakePendingTiles();
  const buffer = canvas.toBuffer("image/png");
  await expectSnapshot(buffer, snapshotName);
}

describe("tile baking snapshots", () => {
  test("bakes a single tile", async () => {
    const shapesRef = {
      shapes: [
        {
          id: "rect-1",
          type: "boxed",
          zIndex: "a",
          geometry: {
            type: "boxed",
            kind: "rect",
            size: v(200, 140),
          } as BoxedGeometry,
          transform: { translation: v(TILE_SIZE / 2, TILE_SIZE / 2) },
          style: {
            fill: solidFill("#2e7d32"),
            stroke: { type: "brush", color: "#0d47a1", size: 8 },
          },
        } as AnyShape,
      ],
    };
    const { renderer, canvases } = createTileRenderer(shapesRef);
    renderer.updateViewport(createViewport(1));
    renderer.updateTouchedTilesForShape(shapesRef.shapes[0]);
    renderer.scheduleBakeForShape("rect-1");
    await bakeAndSnapshot(renderer, canvases, { x: 0, y: 0 }, "tile-single");
  });

  test("rebuilds both tiles when a shape moves across boundary", async () => {
    const shapesRef = {
      shapes: [
        {
          id: "rect-1",
          type: "boxed",
          zIndex: "a",
          geometry: {
            type: "boxed",
            kind: "rect",
            size: v(220, 140),
          } as BoxedGeometry,
          transform: { translation: v(TILE_SIZE / 2, TILE_SIZE / 2) },
          style: {
            fill: solidFill("#f57c00"),
            stroke: { type: "brush", color: "#e65100", size: 6 },
          },
        } as AnyShape,
      ],
    };
    const { renderer, canvases } = createTileRenderer(shapesRef);
    renderer.updateViewport(createViewport(2));
    renderer.updateTouchedTilesForShape(shapesRef.shapes[0]);
    renderer.scheduleBakeForShape("rect-1");
    await renderer.bakePendingTiles();

    shapesRef.shapes = [
      {
        ...shapesRef.shapes[0],
        transform: {
          translation: v(TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2),
        },
      } as AnyShape,
    ];
    renderer.updateTouchedTilesForShape(shapesRef.shapes[0]);
    renderer.scheduleBakeForShape("rect-1");
    const pending = renderer.getPendingBakeTiles().map(tileKey);
    if (pending.join(",") !== "0,0,1,0") {
      throw new Error(`Expected pending tiles 0,0 and 1,0, got ${pending}`);
    }
    await renderer.bakePendingTiles();

    const leftCanvas = canvases.get(tileKey({ x: 0, y: 0 }));
    if (!leftCanvas) throw new Error("Missing left tile canvas");
    await expectSnapshot(
      leftCanvas.toBuffer("image/png"),
      "tile-move-left-cleared",
    );
    const rightCanvas = canvases.get(tileKey({ x: 1, y: 0 }));
    if (!rightCanvas) throw new Error("Missing right tile canvas");
    await expectSnapshot(
      rightCanvas.toBuffer("image/png"),
      "tile-move-right-filled",
    );
  });

  test("bakes composite op stacking into tiles", async () => {
    const shapesRef = {
      shapes: [
        {
          id: "rect-1",
          type: "boxed",
          zIndex: "a",
          geometry: {
            type: "boxed",
            kind: "rect",
            size: v(320, 220),
          } as BoxedGeometry,
          transform: { translation: v(TILE_SIZE / 2, TILE_SIZE / 2) },
          style: {
            fill: solidFill("#263238"),
            stroke: { type: "brush", color: "#102027", size: 6 },
          },
        } as AnyShape,
        {
          id: "pen-1",
          type: "pen",
          zIndex: "b",
          geometry: createPenJSONGeometry(
            [v(-120, 0), v(-40, -80), v(40, 80), v(120, 0)],
            [1, 1, 1, 1],
          ),
          transform: { translation: v(TILE_SIZE / 2, TILE_SIZE / 2) },
          style: {
            stroke: {
              type: "brush",
              color: "#ffffff",
              size: 26,
              brushId: "marker",
              compositeOp: "destination-out",
            },
          },
        } as AnyShape,
      ],
    };
    const { renderer, canvases } = createTileRenderer(shapesRef);
    renderer.updateViewport(createViewport(1));
    for (const shape of shapesRef.shapes) {
      renderer.updateTouchedTilesForShape(shape);
    }
    renderer.scheduleBakeForShapes(["rect-1", "pen-1"]);
    await bakeAndSnapshot(
      renderer,
      canvases,
      { x: 0, y: 0 },
      "tile-composite-stack",
    );
  });

  test("bakes eraser strokes into tiles", async () => {
    const shapesRef = {
      shapes: [
        {
          id: "rect-1",
          type: "boxed",
          zIndex: "a",
          geometry: {
            type: "boxed",
            kind: "rect",
            size: v(220, 160),
          } as BoxedGeometry,
          transform: { translation: v(TILE_SIZE / 2, TILE_SIZE / 2) },
          style: {
            fill: solidFill("#1976d2"),
            stroke: { type: "brush", color: "#0d47a1", size: 6 },
          },
        } as AnyShape,
        {
          id: "eraser-1",
          type: "pen",
          zIndex: "b",
          geometry: createPenJSONGeometry(
            [v(-90, -50), v(-20, 0), v(40, -20), v(90, 50)],
            [1, 1, 1, 1],
          ),
          transform: { translation: v(TILE_SIZE / 2, TILE_SIZE / 2) },
          style: {
            stroke: {
              type: "brush",
              color: "#ffffff",
              size: 22,
              brushId: "marker",
              compositeOp: "destination-out",
            },
          },
        } as AnyShape,
      ],
    };
    const { renderer, canvases } = createTileRenderer(shapesRef);
    renderer.updateViewport(createViewport(1));
    for (const shape of shapesRef.shapes) {
      renderer.updateTouchedTilesForShape(shape);
    }
    renderer.scheduleBakeForShapes(["rect-1", "eraser-1"]);
    await bakeAndSnapshot(
      renderer,
      canvases,
      { x: 0, y: 0 },
      "tile-eraser-stroke",
    );
  });
});
