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
