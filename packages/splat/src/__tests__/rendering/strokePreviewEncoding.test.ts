import { expect, test } from "bun:test";
import {
  createAppendOnlyPenGeometryEncoder,
  type PenGeometry,
  type PenShape,
} from "@smalldraw/core";
import { createCanvas } from "canvas";
import { renderPen } from "../../shapes/renderers/pen";

// Compare the local cached preview with the same geometry after serialization,
// covering translucent overlap and erasing as well as opaque brushes.
test.each([
  "freehand",
  "marker",
  "even-spraycan",
  "uneven-spraycan",
  "eraser",
])("cached %s preview pixels match persisted JSON", (brush) => {
  const encode = createAppendOnlyPenGeometryEncoder();
  const points: [number, number][] = [];
  const pressures: number[] = [];
  const snapshots: PenGeometry[] = [];
  for (let i = 0; i < 1000; i++) {
    points.push([
      Math.fround(60 + Math.cos(i * 0.04) * 40),
      Math.fround(60 + Math.sin(i * 0.07) * 40),
    ]);
    pressures.push((i % 10) / 10);
    if ([0, 5, 100, 999].includes(i))
      snapshots.push(encode(points, pressures.slice()));
  }
  for (const geometry of snapshots) {
    const render = (geometry: PenGeometry) => {
      const canvas = createCanvas(120, 120);
      const ctx = canvas.getContext(
        "2d",
      ) as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = "#459abd";
      ctx.fillRect(0, 0, 120, 120);
      const shape = {
        id: "preview",
        type: "pen",
        geometry,
        zIndex: "a0",
        temporary: true,
        style: {
          stroke: {
            type: "brush",
            brushId: brush === "eraser" ? "marker" : brush,
            size: 8,
            color: "#271c9a",
            compositeOp: brush === "eraser" ? "destination-out" : "source-over",
          },
        },
      } as PenShape;
      renderPen(ctx, shape);
      return canvas.toBuffer("raw");
    };
    expect(
      render(geometry).equals(render(JSON.parse(JSON.stringify(geometry)))),
    ).toBe(true);
  }
});
