import { featherMask, floodFillMask } from "./floodFill";

export interface FillPixelsRequest {
  imageData: Uint8ClampedArray;
  width: number;
  height: number;
  x: number;
  y: number;
  color: { r: number; g: number; b: number };
  tolerance: number;
  featherRadius: number;
}

export interface FillPixelsResult {
  pixels: Uint8ClampedArray;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pure computation shared by the worker and pixel-equivalence tests. */
export function computeFillPixels(
  request: FillPixelsRequest,
): FillPixelsResult | null {
  const { width, height, color } = request;
  const mask = floodFillMask({
    ...request,
    options: { tolerance: request.tolerance },
  });
  const alpha = featherMask(mask, width, height, {
    radius: request.featherRadius,
  });
  // Preserve all nonzero feathered pixels, but don't retain transparent canvas area.
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!alpha[y * width + x]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) return null;
  const croppedWidth = right - left + 1;
  const croppedHeight = bottom - top + 1;
  const pixels = new Uint8ClampedArray(croppedWidth * croppedHeight * 4);
  for (let y = 0; y < croppedHeight; y++) {
    for (let x = 0; x < croppedWidth; x++) {
      const value = alpha[(y + top) * width + x + left];
      if (!value) continue;
      const offset = (y * croppedWidth + x) * 4;
      pixels[offset] = color.r;
      pixels[offset + 1] = color.g;
      pixels[offset + 2] = color.b;
      pixels[offset + 3] = value;
    }
  }
  return {
    pixels,
    x: left,
    y: top,
    width: croppedWidth,
    height: croppedHeight,
  };
}
