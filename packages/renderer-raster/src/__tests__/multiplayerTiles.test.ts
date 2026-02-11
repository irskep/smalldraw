import { describe, expect, test } from "bun:test";
import { merge } from "@automerge/automerge/slim";
import type { DrawingDocument } from "@smalldraw/core";
import {
  AddShape,
  type AnyShape,
  type BoxedGeometry,
  createPenJSONGeometry,
  DeleteShape,
  DrawingStore,
  getDefaultShapeHandlerRegistry,
  getOrderedShapes,
  UpdateShapeTransform,
} from "@smalldraw/core";
import type { Box } from "@smalldraw/geometry";
import { renderOrderedShapes } from "@smalldraw/renderer-canvas";
import { imagesMatch } from "@smalldraw/testing";
import { createCanvas } from "canvas";
import { TILE_SIZE, TileRenderer } from "../index";

const v = (x = 0, y = x): [number, number] => [x, y];

function createViewport(tileCountX: number, tileCountY = 1): Box {
  return {
    min: [0, 0],
    max: [TILE_SIZE * tileCountX, TILE_SIZE * tileCountY],
  };
}

function createRect(id: string, translation: [number, number]): AnyShape {
  return {
    id,
    type: "boxed",
    zIndex: "a",
    geometry: {
      type: "boxed",
      kind: "rect",
      size: v(240, 160),
    } as BoxedGeometry,
    transform: { translation },
    style: {
      fill: { type: "solid", color: "#2e7d32" },
      stroke: { type: "brush", color: "#0d47a1", size: 6 },
    },
  };
}

function createPen(id: string, translation: [number, number]): AnyShape {
  return {
    id,
    type: "pen",
    zIndex: "b",
    geometry: createPenJSONGeometry(
      [v(-80, -20), v(-20, 40), v(40, -10), v(80, 30)],
      [1, 1, 1, 1],
    ),
    transform: { translation },
    style: {
      stroke: {
        type: "brush",
        color: "#e65100",
        size: 14,
        brushId: "freehand",
      },
    },
  };
}

async function renderTileFromDoc(
  doc: DrawingDocument,
  tileX = 0,
  tileY = 0,
): Promise<Buffer> {
  const registry = getDefaultShapeHandlerRegistry();
  const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-tileX * TILE_SIZE, -tileY * TILE_SIZE);
  renderOrderedShapes(ctx, getOrderedShapes(doc), {
    clear: false,
    geometryHandlerRegistry: registry,
  });
  ctx.restore();
  return canvas.toBuffer("image/png");
}

async function bakeTileFromDoc(
  doc: DrawingDocument,
  tileX = 0,
  tileY = 0,
): Promise<Buffer> {
  const registry = getDefaultShapeHandlerRegistry();
  const store = new DrawingStore({ tools: [], shapeHandlers: registry });
  store.applyDocument(doc);
  const canvases = new Map<string, ReturnType<typeof createCanvas>>();
  const provider = {
    getTileCanvas: (coord: { x: number; y: number }) => {
      const key = `${coord.x},${coord.y}`;
      const existing = canvases.get(key);
      if (existing) return existing;
      const canvas = createCanvas(TILE_SIZE, TILE_SIZE);
      canvases.set(key, canvas);
      return canvas;
    },
  };
  const renderer = new TileRenderer(store, provider, {
    shapeHandlers: registry,
    baker: {
      bakeTile: async (coord, canvas) => {
        const ctx = canvas.getContext(
          "2d",
        ) as unknown as CanvasRenderingContext2D;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-coord.x * TILE_SIZE, -coord.y * TILE_SIZE);
        renderOrderedShapes(ctx, getOrderedShapes(doc), {
          clear: false,
          geometryHandlerRegistry: registry,
        });
        ctx.restore();
      },
    },
  });
  renderer.updateViewport(createViewport(1));
  const ordered = getOrderedShapes(doc);
  for (const shape of ordered) {
    renderer.updateTouchedTilesForShape(shape);
  }
  renderer.scheduleBakeForShapes(ordered.map((shape) => shape.id));
  await renderer.bakePendingTiles();
  const key = `${tileX},${tileY}`;
  const canvas = canvases.get(key);
  if (!canvas) {
    throw new Error(`Missing baked tile ${key}`);
  }
  return canvas.toBuffer("image/png");
}

describe("multiplayer tiles", () => {
  test("merge order yields identical tile output", async () => {
    const registry = getDefaultShapeHandlerRegistry();
    const storeA = new DrawingStore({ tools: [], shapeHandlers: registry });
    const storeB = new DrawingStore({ tools: [], shapeHandlers: registry });

    storeA.applyAction(
      new AddShape(createRect("rect-a", v(TILE_SIZE / 2, TILE_SIZE / 2))),
    );
    storeB.applyAction(
      new AddShape(createPen("pen-b", v(TILE_SIZE / 2, TILE_SIZE / 2))),
    );

    const mergedAB = merge(storeA.getDocument(), storeB.getDocument());
    const mergedBA = merge(storeB.getDocument(), storeA.getDocument());

    const bufferAB = await bakeTileFromDoc(mergedAB);
    const bufferBA = await bakeTileFromDoc(mergedBA);
    expect(await imagesMatch(bufferAB, bufferBA, 0)).toBeTrue();
  });

  test("merge order stable under delete and undo/redo", async () => {
    const registry = getDefaultShapeHandlerRegistry();
    const storeA = new DrawingStore({ tools: [], shapeHandlers: registry });
    const storeB = new DrawingStore({ tools: [], shapeHandlers: registry });

    storeA.applyAction(
      new AddShape(createRect("rect-a", v(TILE_SIZE / 2, TILE_SIZE / 2))),
    );
    storeB.applyAction(
      new AddShape(createPen("pen-b", v(TILE_SIZE / 2, TILE_SIZE / 2))),
    );

    storeA.applyAction(new DeleteShape("rect-a"));
    storeA.undo();
    storeA.redo();
    storeB.applyAction(
      new UpdateShapeTransform("pen-b", {
        translation: v(TILE_SIZE / 2 + 120, TILE_SIZE / 2),
      }),
    );

    const mergedAB = merge(storeA.getDocument(), storeB.getDocument());
    const mergedBA = merge(storeB.getDocument(), storeA.getDocument());

    const bufferAB = await renderTileFromDoc(mergedAB);
    const bufferBA = await renderTileFromDoc(mergedBA);
    expect(await imagesMatch(bufferAB, bufferBA, 0)).toBeTrue();
  });
});
