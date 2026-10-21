import { expect, test } from "bun:test";
import { createFillComputation } from "../../tools/fillComputation";
import {
  computeFillPixels,
  type FillPixelsRequest,
} from "../../tools/fillPixels";
import { featherMask, floodFillMask } from "../../tools/floodFill";

function fixture(): FillPixelsRequest {
  const width = 81;
  const height = 57;
  const imageData = new Uint8ClampedArray(width * height * 4).fill(255);
  // A closed wall with an opening, plus alpha variation, exercises traversal and feathering.
  for (let y = 0; y < height - 3; y++)
    imageData.fill(0, (y * width + 40) * 4, (y * width + 41) * 4);
  return {
    imageData,
    width,
    height,
    x: 2,
    y: 3,
    color: { r: 37, g: 80, b: 230 },
    tolerance: 30,
    featherRadius: 2,
  };
}

test("worker transfers exactly the same fill pixels as synchronous computation", async () => {
  const computation = createFillComputation(
    new URL("../../tools/fillWorker.ts", import.meta.url),
  );
  try {
    for (const radius of [0, 2, 7]) {
      const request = { ...fixture(), featherRadius: radius };
      const expected = computeFillPixels(request);
      const result = await computation.compute(request);
      expect(result).toEqual(expected);
      expect(request.imageData.byteLength).toBe(0);
    }
  } finally {
    computation.dispose();
  }
});

test("disposal cancels pending work and settles its promise", async () => {
  const computation = createFillComputation(
    new URL("../../tools/fillWorker.ts", import.meta.url),
  );
  const result = computation.compute(fixture());
  computation.dispose();
  expect(await result).toBeNull();
});

test("cropped fill reconstructs the original feathered pixels exactly", () => {
  for (const radius of [0, 2, 7]) {
    const request = fixture();
    request.featherRadius = radius;
    // Close the wall so this fill covers only part of the canvas.
    for (let y = 0; y < request.height; y++)
      request.imageData.fill(
        0,
        (y * request.width + 40) * 4,
        (y * request.width + 41) * 4,
      );
    const mask = floodFillMask({
      ...request,
      options: { tolerance: request.tolerance },
    });
    const alpha = featherMask(mask, request.width, request.height, { radius });
    const cropped = computeFillPixels(request)!;
    expect(cropped.width).toBeLessThan(request.width);
    const expanded = new Uint8ClampedArray(request.width * request.height * 4);
    for (let y = 0; y < cropped.height; y++)
      expanded.set(
        cropped.pixels.subarray(
          y * cropped.width * 4,
          (y + 1) * cropped.width * 4,
        ),
        ((y + cropped.y) * request.width + cropped.x) * 4,
      );
    for (let i = 0; i < alpha.length; i++) {
      expect(expanded[i * 4 + 3]).toBe(alpha[i]);
      if (alpha[i])
        expect([...expanded.subarray(i * 4, i * 4 + 3)]).toEqual([37, 80, 230]);
    }
  }
});
