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

// Independent small-image oracle: walk matching neighbours with a JS stack.
function referenceFlood(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance: number,
): Uint8Array {
  const start =
    Math.min(height - 1, Math.max(0, Math.floor(startY))) * width +
    Math.min(width - 1, Math.max(0, Math.floor(startX)));
  const pending = [start];
  const seen = new Set<number>();
  const mask = new Uint8Array(width * height);
  while (pending.length) {
    const index = pending.pop()!;
    if (seen.has(index)) continue;
    seen.add(index);
    let distance = 0;
    for (let channel = 0; channel < 4; channel++)
      distance += (data[index * 4 + channel] - data[start * 4 + channel]) ** 2;
    if (distance > Math.max(0, tolerance) ** 2 * 4) continue;
    mask[index] = 255;
    if (index % width > 0) pending.push(index - 1);
    if (index % width < width - 1) pending.push(index + 1);
    if (index >= width) pending.push(index - width);
    if (index < width * (height - 1)) pending.push(index + width);
  }
  return mask;
}

// Direct box-kernel convolution, with the same Float32 horizontal precision
// as the renderer. No sliding sums or traversal shared with production code.
function referenceFeather(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const result = new Uint8Array(mask.length);
  const sample = (x: number, y: number) =>
    mask[
      Math.max(0, Math.min(height - 1, y)) * width +
        Math.max(0, Math.min(width - 1, x))
    ];
  const kernel = radius * 2 + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        let horizontal = 0;
        for (let dx = -radius; dx <= radius; dx++)
          horizontal += sample(x + dx, y + dy);
        sum += Math.fround(horizontal / kernel);
      }
      result[y * width + x] = Math.max(
        mask[y * width + x],
        Math.round(sum / kernel),
      );
    }
  }
  return result;
}

test("flood and feather match independent pixel oracles across boundaries and tolerances", () => {
  let seed = 123456;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  for (const [width, height] of [
    [1, 1],
    [1, 19],
    [23, 1],
    [17, 13],
    [64, 31],
  ]) {
    for (const tolerance of [-1, 0, 30, 128, 255]) {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i++) data[i] = (random() >>> 24) & 192;
      for (const [x, y] of [
        [-4, -2],
        [width / 2, height / 2],
        [width + 8, height + 2],
      ]) {
        const expected = referenceFlood(data, width, height, x, y, tolerance);
        const actual = floodFillMask({
          imageData: data,
          width,
          height,
          x,
          y,
          options: { tolerance },
        });
        expect(actual).toEqual(expected);
        for (const radius of [0, 1, 2, 8])
          expect(featherMask(actual, width, height, { radius })).toEqual(
            referenceFeather(expected, width, height, radius),
          );
      }
    }
  }
});

test("feather preserves fractional horizontal precision for arbitrary alpha masks", () => {
  const width = 37;
  const height = 23;
  const mask = Uint8Array.from(
    { length: width * height },
    (_, i) => (i * 73 + Math.floor(i / width) * 29) % 256,
  );
  for (const radius of [1, 2, 3, 9])
    expect(featherMask(mask, width, height, { radius })).toEqual(
      referenceFeather(mask, width, height, radius),
    );
});
