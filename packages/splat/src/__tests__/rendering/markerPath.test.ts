import { describe, expect, test } from "bun:test";

import { createCanvas } from "canvas";

import { renderMarkerPath } from "../../shapes/renderers/markerPath";

describe("marker path renderer", () => {
  test("renders a single-point marker stroke as a circle", () => {
    const canvas = createCanvas(24, 24);
    const ctx = canvas.getContext("2d");

    ctx.strokeStyle = "#ff0000";
    renderMarkerPath(ctx as unknown as CanvasRenderingContext2D, [[12, 12]], 8);

    const center = ctx.getImageData(12, 12, 1, 1).data;
    expect(Array.from(center)).toEqual([255, 0, 0, 255]);

    const outside = ctx.getImageData(2, 2, 1, 1).data;
    expect(outside[3]).toBe(0);
  });
});

for (const preview of [false, true]) {
  for (const count of [1, 3]) {
    test(`stationary marker paints a circle before smoothing (${count} samples, preview=${preview})`, () => {
      let arcs = 0;
      let fills = 0;
      const ctx = {
        strokeStyle: "#ff0000",
        beginPath() {},
        arc(x: number, y: number, radius: number) {
          expect([x, y, radius]).toEqual([12, 12, 4]);
          arcs++;
        },
        fill() {
          fills++;
        },
        stroke() {
          throw new Error(
            "A stationary stroke must paint a dot, not a zero-length path",
          );
        },
      } as unknown as CanvasRenderingContext2D;
      renderMarkerPath(
        ctx,
        Array.from({ length: count }, () => [12, 12]),
        8,
        preview,
      );
      expect(arcs).toBe(1);
      expect(fills).toBe(1);
    });
  }
}
