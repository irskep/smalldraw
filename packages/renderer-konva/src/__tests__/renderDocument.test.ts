import { describe, test } from "bun:test";

import {
  type AnyShape,
  createDocument,
  getDefaultShapeHandlerRegistry,
  type PenGeometry,
  type RectGeometry,
} from "@smalldraw/core";
import { Vec2 } from "gl-matrix";
import type { Viewport } from "../index";
import { expectSnapshot, renderDocumentToImage } from "./snapshotUtils";

const v = (x = 0, y = x): [number, number] => [x, y];

const baseViewport: Viewport = {
  width: 120,
  height: 120,
  center: new Vec2(0),
  scale: 1,
  backgroundColor: "#ffffff",
};

async function expectDocumentSnapshot(
  name: string,
  shapes: AnyShape[],
  viewport: Viewport = baseViewport,
) {
  const registry = getDefaultShapeHandlerRegistry();
  const document = createDocument(shapes, registry);
  const image = await renderDocumentToImage(
    document,
    viewport,
    undefined,
    registry,
  );
  await expectSnapshot(image, name);
}

describe("renderer snapshots", () => {
  test("solid rectangle with stroke", async () => {
    await expectDocumentSnapshot("rectangle-solid", [
      {
        id: "solid-rect",
        type: "rect",
        zIndex: "a",
        geometry: { type: "rect", size: v(80, 60) } as RectGeometry,
        style: {
          fill: { type: "solid", color: "#2E7D32" },
          stroke: { type: "brush", color: "#0D47A1", size: 4 },
        },
        transform: { translation: v(-15, 0) },
      },
    ]);
  });

  test("pen strokes and raw strokes", async () => {
    await expectDocumentSnapshot(
      "pen-strokes",
      [
        {
          id: "pen-shape",
          type: "pen",
          zIndex: "a",
          geometry: {
            type: "pen",
            points: [
              v(-80, -10),
              v(-40, -30),
              v(-10, -5),
              v(20, -35),
              v(60, 0),
              v(30, 30),
            ],
            pressures: [1, 1, 1, 1, 1, 1],
          } as PenGeometry,
          style: { stroke: { type: "brush", color: "#e65100", size: 10 } },
        },
        {
          id: "polyline-stroke",
          type: "pen",
          zIndex: "b",
          geometry: {
            type: "pen",
            points: [v(-80, 40), v(-20, 20), v(0, 50), v(60, 40)],
            pressures: [1, 1, 1, 1],
          } as PenGeometry,
          style: { stroke: { type: "brush", color: "#1e88e5", size: 4 } },
        },
      ],
      {
        width: 260,
        height: 180,
        center: new Vec2(0, 0),
        scale: 1,
        backgroundColor: "#ffffff",
      },
    );
  });

  test("transforms: rotation and scaling", async () => {
    await expectDocumentSnapshot(
      "transforms",
      [
        {
          id: "rotated-rect",
          type: "rect",
          zIndex: "a",
          geometry: { type: "rect", size: v(80, 40) } as RectGeometry,
          style: {
            fill: { type: "solid", color: "#26c6da" },
            stroke: { type: "brush", color: "#00838f", size: 3 },
          },
          transform: {
            translation: v(-20, -10),
            rotation: Math.PI / 4,
          },
        },
      ],
      {
        width: 240,
        height: 200,
        center: new Vec2(0, 0),
        scale: 1,
        backgroundColor: "#ffffff",
      },
    );
  });
});
