export interface FloodFillOptions {
  tolerance: number;
}

export interface FeatherOptions {
  radius: number;
}

function colorDistanceSquared(
  data: Uint8ClampedArray,
  pixelIndex: number,
  targetR: number,
  targetG: number,
  targetB: number,
  targetA: number,
): number {
  const offset = pixelIndex * 4;
  const dr = data[offset] - targetR;
  const dg = data[offset + 1] - targetG;
  const db = data[offset + 2] - targetB;
  const da = data[offset + 3] - targetA;
  return dr * dr + dg * dg + db * db + da * da;
}

export function floodFillMask(params: {
  imageData: Uint8ClampedArray;
  width: number;
  height: number;
  x: number;
  y: number;
  options: FloodFillOptions;
}): Uint8Array {
  const { imageData, width, height, options } = params;
  const startX = Math.min(width - 1, Math.max(0, Math.floor(params.x)));
  const startY = Math.min(height - 1, Math.max(0, Math.floor(params.y)));
  const pixelCount = width * height;
  const startIndex = startY * width + startX;
  const startOffset = startIndex * 4;
  const targetR = imageData[startOffset];
  const targetG = imageData[startOffset + 1];
  const targetB = imageData[startOffset + 2];
  const targetA = imageData[startOffset + 3];
  const tolerance = Math.max(0, options.tolerance);
  const toleranceSq = tolerance * tolerance * 4;

  const mask = new Uint8Array(pixelCount);
  const visited = new Uint8Array(pixelCount);
  // Mark on enqueue: each pixel enters the queue at most once.
  const queue = new Int32Array(Math.max(1, pixelCount));
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;
  visited[startIndex] = 1;

  while (head < tail) {
    const current = queue[head++];
    if (current < 0 || current >= pixelCount) continue;
    if (
      colorDistanceSquared(
        imageData,
        current,
        targetR,
        targetG,
        targetB,
        targetA,
      ) > toleranceSq
    ) {
      continue;
    }

    mask[current] = 255;
    const x = current % width;
    const y = Math.floor(current / width);

    if (x > 0 && !visited[current - 1]) {
      visited[current - 1] = 1;
      queue[tail++] = current - 1;
    }
    if (x < width - 1 && !visited[current + 1]) {
      visited[current + 1] = 1;
      queue[tail++] = current + 1;
    }
    if (y > 0 && !visited[current - width]) {
      visited[current - width] = 1;
      queue[tail++] = current - width;
    }
    if (y < height - 1 && !visited[current + width]) {
      visited[current + width] = 1;
      queue[tail++] = current + width;
    }
  }

  return mask;
}

function blurHorizontal(
  source: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  const destination = new Float32Array(width * height);
  const kernelSize = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    const rowStart = y * width;
    for (let dx = -radius; dx <= radius; dx += 1) {
      const sampleX = Math.min(width - 1, Math.max(0, dx));
      sum += source[rowStart + sampleX];
    }
    destination[rowStart] = sum / kernelSize;
    for (let x = 1; x < width; x += 1) {
      const prevX = Math.max(0, x - radius - 1);
      const nextX = Math.min(width - 1, x + radius);
      sum += source[rowStart + nextX] - source[rowStart + prevX];
      destination[rowStart + x] = sum / kernelSize;
    }
  }
  return destination;
}

function blurVertical(
  source: Float32Array,
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const destination = new Uint8Array(width * height);
  const kernelSize = radius * 2 + 1;
  // Keep each column's double-precision running sum, but visit contiguous
  // rows. The summation and rounding order for each pixel stays unchanged.
  const sums = new Float64Array(width);
  for (let dy = -radius; dy <= radius; dy += 1) {
    const rowStart = Math.min(height - 1, Math.max(0, dy)) * width;
    for (let x = 0; x < width; x += 1) sums[x] += source[rowStart + x];
  }
  for (let x = 0; x < width; x += 1)
    destination[x] = Math.max(mask[x], Math.round(sums[x] / kernelSize));
  for (let y = 1; y < height; y += 1) {
    const rowStart = y * width;
    const prevRow = Math.max(0, y - radius - 1) * width;
    const nextRow = Math.min(height - 1, y + radius) * width;
    for (let x = 0; x < width; x += 1) {
      sums[x] += source[nextRow + x] - source[prevRow + x];
      destination[rowStart + x] = Math.max(
        mask[rowStart + x],
        Math.round(sums[x] / kernelSize),
      );
    }
  }
  return destination;
}

export function featherMask(
  mask: Uint8Array,
  width: number,
  height: number,
  options: FeatherOptions,
): Uint8Array {
  const radius = Math.max(0, Math.floor(options.radius));
  if (radius === 0) {
    return mask;
  }
  const horizontal = blurHorizontal(mask, width, height, radius);
  return blurVertical(horizontal, mask, width, height, radius);
}
