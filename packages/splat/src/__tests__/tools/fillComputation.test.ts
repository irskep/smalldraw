import { expect, test } from "bun:test";
import { createFillComputation } from "../../tools/fillComputation";
import {
  computeFillPixels,
  type FillPixelsRequest,
} from "../../tools/fillPixels";

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
