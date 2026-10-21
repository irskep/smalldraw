import { describe, expect, spyOn, test } from "bun:test";

import {
  type AnyShape,
  type BoxedGeometry,
  getDefaultShapeHandlerRegistry,
  type Shape,
} from "@smalldraw/core";
import { renderOrderedShapes } from "@smalldraw/renderer-canvas";
import { createCanvas } from "canvas";

import { createTileShapeFilter } from "../tileShapeFilter";
import { createTestShapeRendererRegistry } from "./testShapeRendererRegistry";

function rect(id: string, x: number, y = 50): AnyShape {
  return {
    id,
    type: "boxed",
    zIndex: id,
    geometry: { type: "boxed", kind: "rect", size: [30, 30] } as BoxedGeometry,
    transform: { translation: [x, y] },
    style: { fill: { type: "solid", color: "#33669988" } },
  };
}
const bounds = {
  min: [0, 0] as [number, number],
  max: [100, 100] as [number, number],
};

describe("tile shape filtering", () => {
  test("skips distant shapes, preserves order, and replays unknown/global bounds", () => {
    const registry = getDefaultShapeHandlerRegistry().clone();
    registry.register("global", { geometry: { getBounds: () => null } });
    const near = rect("near", 50),
      far = rect("far", 1000);
    const global = { ...rect("global", 1000), type: "global" };
    const unknown = { ...rect("unknown", 1000), type: "unknown" };
    expect(
      createTileShapeFilter(registry)([far, near, global, unknown], bounds),
    ).toEqual([near, global, unknown]);
  });

  test("reuses immutable bounds and recomputes moved or restyled replacements", () => {
    const registry = getDefaultShapeHandlerRegistry().clone();
    const handler = registry.get("boxed")!;
    const calls = spyOn(handler.geometry!, "getBounds");
    try {
      const shape = rect("moving", 1000);
      const select = createTileShapeFilter(registry);
      expect(select([shape], bounds)).toEqual([]);
      expect(select([shape], bounds)).toEqual([]);
      expect(calls).toHaveBeenCalledTimes(1);
      const moved = {
        ...shape,
        transform: { translation: [110, 50] as [number, number] },
        style: { ...shape.style },
      };
      moved.style.stroke = { type: "brush", color: "black", size: 10 };
      expect(select([moved], bounds)).toEqual([moved]);
      expect(calls).toHaveBeenCalledTimes(2);
    } finally {
      calls.mockRestore();
    }
  });

  test.each([1, 2])(
    "matches full replay pixels at DPR %s across boundaries and transforms",
    (dpr) => {
      const registry = getDefaultShapeHandlerRegistry();
      const renderers = createTestShapeRendererRegistry();
      const shapes: Shape[] = [];
      for (let i = 0; i < 70; i++) {
        const shape = rect(
          String(i),
          ((i * 47) % 500) - 150,
          ((i * 29) % 250) - 50,
        );
        shape.transform = {
          ...shape.transform!,
          rotation: i * 0.17,
          scale: [i % 2 ? -1.3 : 0.7, 1.2],
          origin: [(i % 3) * 15, -12],
        };
        shape.style.stroke = {
          type: "brush",
          size: 3 + (i % 8),
          color: "#55339988",
        };
        shapes.push(shape);
      }
      shapes.push({
        id: "erase",
        type: "pen",
        zIndex: "z",
        geometry: {
          type: "pen-json",
          pointsJson: "[[-140,50],[320,50]]",
          pointCount: 2,
        },
        style: {
          stroke: {
            type: "brush",
            brushId: "marker",
            size: 20,
            color: "black",
            compositeOp: "destination-out",
          },
        },
      } as AnyShape);
      const select = createTileShapeFilter(registry);
      for (const tileX of [-1, 0, 1, 2]) {
        const tile = {
          min: [tileX * 100 - 2 / dpr, -2 / dpr] as [number, number],
          max: [(tileX + 1) * 100 + 2 / dpr, 100 + 2 / dpr] as [number, number],
        };
        const selected = select(shapes, tile);
        expect(selected.length).toBeLessThan(shapes.length);
        const pixels = (input: Shape[]) => {
          const canvas = createCanvas(100 * dpr, 100 * dpr);
          const ctx = canvas.getContext("2d");
          ctx.setTransform(dpr, 0, 0, dpr, -tileX * 100 * dpr, 0);
          renderOrderedShapes(
            ctx as unknown as CanvasRenderingContext2D,
            input,
            {
              registry: renderers,
              geometryHandlerRegistry: registry,
              clear: false,
            },
          );
          return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        };
        expect(pixels(selected)).toEqual(pixels(shapes));
      }
    },
  );
});
