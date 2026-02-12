import { describe, expect, test } from "bun:test";
import { featherMask, floodFillMask } from "../../tools/floodFill";

function createSolidImageData(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    data[offset] = rgba[0];
    data[offset + 1] = rgba[1];
    data[offset + 2] = rgba[2];
    data[offset + 3] = rgba[3];
  }
  return data;
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  rgba: [number, number, number, number],
): void {
  const offset = (y * width + x) * 4;
  data[offset] = rgba[0];
  data[offset + 1] = rgba[1];
  data[offset + 2] = rgba[2];
  data[offset + 3] = rgba[3];
}

function maskAt(mask: Uint8Array, width: number, x: number, y: number): number {
  return mask[y * width + x];
}

describe("flood fill", () => {
  test("fills only contiguous matching region", () => {
    const width = 5;
    const height = 5;
    const data = createSolidImageData(width, height, [255, 255, 255, 255]);
    for (let y = 0; y < height; y += 1) {
      setPixel(data, width, 2, y, [0, 0, 0, 255]);
    }
    const leftStart = [0, 2] as const;
    const mask = floodFillMask({
      imageData: data,
      width,
      height,
      x: leftStart[0],
      y: leftStart[1],
      options: { tolerance: 0 },
    });

    expect(maskAt(mask, width, 0, 2)).toBe(255);
    expect(maskAt(mask, width, 1, 2)).toBe(255);
    expect(maskAt(mask, width, 2, 2)).toBe(0);
    expect(maskAt(mask, width, 3, 2)).toBe(0);
    expect(maskAt(mask, width, 4, 2)).toBe(0);
  });

  test("tolerance includes near colors", () => {
    const width = 3;
    const height = 1;
    const data = createSolidImageData(width, height, [100, 100, 100, 255]);
    setPixel(data, width, 1, 0, [108, 100, 100, 255]);
    setPixel(data, width, 2, 0, [150, 100, 100, 255]);

    const lowToleranceMask = floodFillMask({
      imageData: data,
      width,
      height,
      x: 0,
      y: 0,
      options: { tolerance: 3 },
    });
    expect(maskAt(lowToleranceMask, width, 0, 0)).toBe(255);
    expect(maskAt(lowToleranceMask, width, 1, 0)).toBe(0);

    const higherToleranceMask = floodFillMask({
      imageData: data,
      width,
      height,
      x: 0,
      y: 0,
      options: { tolerance: 10 },
    });
    expect(maskAt(higherToleranceMask, width, 1, 0)).toBe(255);
    expect(maskAt(higherToleranceMask, width, 2, 0)).toBe(0);
  });

  test("feathering creates soft edge alpha", () => {
    const width = 7;
    const height = 1;
    const mask = new Uint8Array(width * height);
    mask[3] = 255;

    const feathered = featherMask(mask, width, height, { radius: 2 });
    expect(feathered[3]).toBe(255);
    expect(feathered[2]).toBeGreaterThan(0);
    expect(feathered[4]).toBeGreaterThan(0);
    expect(feathered[1]).toBeGreaterThan(0);
    expect(feathered[5]).toBeGreaterThan(0);
    expect(feathered[0]).toBe(0);
    expect(feathered[6]).toBe(0);
  });
});
