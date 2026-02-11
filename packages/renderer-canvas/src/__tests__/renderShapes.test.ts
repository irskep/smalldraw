import { describe, test } from "bun:test";
import {
  type AnyShape,
  createDocument,
  getDefaultShapeHandlerRegistry,
  type PenGeometry,
  type BoxedGeometry,
} from "@smalldraw/core";
import { expectSnapshot, renderDocumentToImage } from "./snapshotUtils";

const v = (x = 0, y = x): [number, number] => [x, y];

async function expectDocumentSnapshot(
  name: string,
  shapes: AnyShape[],
  width = 200,
  height = 200,
) {
  const registry = getDefaultShapeHandlerRegistry();
  const document = createDocument(
    shapes.map((shape) => ({
      ...shape,
      transform: {
        ...shape.transform,
        translation: shape.transform?.translation ?? v(width / 2, height / 2),
      },
    })),
    registry,
  );
  const image = await renderDocumentToImage(document, width, height, {
    background: "#ffffff",
  });
  await expectSnapshot(image, name);
}

describe("renderer-canvas snapshots", () => {
  test("solid rectangle", async () => {
    await expectDocumentSnapshot("canvas-rect-solid", [
      {
        id: "rect-1",
        type: "boxed",
        zIndex: "a",
        geometry: { type: "boxed", kind: "rect", size: v(120, 80) } as BoxedGeometry,
        style: {
          fill: { type: "solid", color: "#2E7D32" },
          stroke: { type: "brush", color: "#0D47A1", size: 6 },
        },
      },
    ]);
  });

  test("pen stroke over rectangle", async () => {
    await expectDocumentSnapshot(
      "canvas-pen-over-rect",
      [
        {
          id: "rect-1",
          type: "boxed",
          zIndex: "a",
          geometry: { type: "boxed", kind: "rect", size: v(140, 90) } as BoxedGeometry,
          style: {
            fill: { type: "solid", color: "#f5f5f5" },
            stroke: { type: "brush", color: "#546e7a", size: 3 },
          },
        },
        {
          id: "pen-1",
          type: "pen",
          zIndex: "b",
          geometry: {
            type: "pen",
            points: [v(-60, -20), v(-20, 20), v(20, -10), v(60, 30)],
            pressures: [1, 1, 1, 1],
          } as PenGeometry,
          style: {
            stroke: {
              type: "brush",
              color: "#e65100",
              size: 10,
              brushId: "freehand",
            },
          },
        },
      ],
      240,
      200,
    );
  });

  test("marker brush stroke over rectangle", async () => {
    await expectDocumentSnapshot(
      "canvas-marker-over-rect",
      [
        {
          id: "rect-1",
          type: "boxed",
          zIndex: "a",
          geometry: { type: "boxed", kind: "rect", size: v(140, 90) } as BoxedGeometry,
          style: {
            fill: { type: "solid", color: "#f5f5f5" },
            stroke: { type: "brush", color: "#546e7a", size: 3 },
          },
        },
        {
          id: "marker-1",
          type: "pen",
          zIndex: "b",
          geometry: {
            type: "pen",
            points: [v(-60, -30), v(-25, 8), v(15, -15), v(58, 26)],
            pressures: [1, 1, 1, 1],
          } as PenGeometry,
          style: {
            stroke: {
              type: "brush",
              color: "#2b8cff",
              size: 14,
              brushId: "marker",
            },
          },
        },
      ],
      240,
      200,
    );
  });

  test("z-order stacking", async () => {
    await expectDocumentSnapshot(
      "canvas-zorder-rects",
      [
        {
          id: "rect-back",
          type: "boxed",
          zIndex: "a",
          geometry: { type: "boxed", kind: "rect", size: v(140, 90) } as BoxedGeometry,
          style: {
            fill: { type: "solid", color: "#d32f2f" },
            stroke: { type: "brush", color: "#b71c1c", size: 4 },
          },
        },
        {
          id: "rect-front",
          type: "boxed",
          zIndex: "b",
          geometry: { type: "boxed", kind: "rect", size: v(90, 60) } as BoxedGeometry,
          style: {
            fill: { type: "solid", color: "#1976d2" },
            stroke: { type: "brush", color: "#0d47a1", size: 4 },
          },
        },
      ],
      240,
      200,
    );
  });

  test("destination-out composite erases prior shapes", async () => {
    await expectDocumentSnapshot(
      "canvas-composite-destination-out",
      [
        {
          id: "rect-solid",
          type: "boxed",
          zIndex: "a",
          geometry: { type: "boxed", kind: "rect", size: v(160, 110) } as BoxedGeometry,
          style: {
            fill: { type: "solid", color: "#263238" },
            stroke: { type: "brush", color: "#102027", size: 6 },
          },
        },
        {
          id: "pen-erase",
          type: "pen",
          zIndex: "b",
          geometry: {
            type: "pen",
            points: [v(-70, 0), v(-20, -30), v(20, 30), v(70, 0)],
            pressures: [1, 1, 1, 1],
          } as PenGeometry,
          style: {
            stroke: {
              type: "brush",
              color: "#ffffff",
              size: 16,
              brushId: "marker",
              compositeOp: "destination-out",
            },
          },
        },
      ],
      260,
      200,
    );
  });

  test("eraser stroke punches through filled shape", async () => {
    await expectDocumentSnapshot(
      "canvas-eraser-stroke",
      [
        {
          id: "rect-base",
          type: "boxed",
          zIndex: "a",
          geometry: { type: "boxed", kind: "rect", size: v(180, 120) } as BoxedGeometry,
          style: {
            fill: { type: "solid", color: "#1976d2" },
            stroke: { type: "brush", color: "#0d47a1", size: 6 },
          },
        },
        {
          id: "eraser-stroke",
          type: "pen",
          zIndex: "b",
          geometry: {
            type: "pen",
            points: [v(-70, -40), v(-10, 0), v(40, -20), v(70, 40)],
            pressures: [1, 1, 1, 1],
          } as PenGeometry,
          style: {
            stroke: {
              type: "brush",
              color: "#ffffff",
              size: 20,
              brushId: "marker",
              compositeOp: "destination-out",
            },
          },
        },
      ],
      260,
      200,
    );
  });
});
