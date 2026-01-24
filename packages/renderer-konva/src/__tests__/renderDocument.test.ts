import { describe, test } from "bun:test";

import {
  createDocument,
  getDefaultShapeHandlerRegistry,
  type Shape,
} from "@smalldraw/core";

import type { Viewport } from "../index";
import { expectSnapshot, renderDocumentToImage } from "./snapshotUtils";

const baseViewport: Viewport = {
  width: 120,
  height: 120,
  center: { x: 0, y: 0 },
  scale: 1,
  backgroundColor: "#ffffff",
};

async function expectDocumentSnapshot(
  name: string,
  shapes: (Shape & { geometry: unknown })[],
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
        geometry: { type: "rect", size: { width: 80, height: 60 } },
        fill: { type: "solid", color: "#2E7D32" },
        stroke: { type: "brush", color: "#0D47A1", size: 4 },
        transform: { translation: { x: -15, y: 0 } },
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
              { x: -80, y: -10 },
              { x: -40, y: -30 },
              { x: -10, y: -5 },
              { x: 20, y: -35 },
              { x: 60, y: 0 },
              { x: 30, y: 30 },
            ],
            simulatePressure: true,
          },
          stroke: { type: "brush", color: "#e65100", size: 10 },
        },
        {
          id: "polyline-stroke",
          type: "pen",
          zIndex: "b",
          geometry: {
            type: "stroke",
            points: [
              { x: -80, y: 40 },
              { x: -20, y: 20 },
              { x: 0, y: 50 },
              { x: 60, y: 40 },
            ],
          },
          stroke: { type: "brush", color: "#1e88e5", size: 4 },
        },
      ],
      {
        width: 260,
        height: 180,
        center: { x: 0, y: 0 },
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
          geometry: { type: "rect", size: { width: 80, height: 40 } },
          fill: { type: "solid", color: "#26c6da" },
          stroke: { type: "brush", color: "#00838f", size: 3 },
          transform: {
            translation: { x: -20, y: -10 },
            rotation: Math.PI / 4,
          },
        },
      ],
      {
        width: 240,
        height: 200,
        center: { x: 0, y: 0 },
        scale: 1,
        backgroundColor: "#ffffff",
      },
    );
  });
});
