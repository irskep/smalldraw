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

/** Pure computation shared by the worker and pixel-equivalence tests. */
export function computeFillPixels(
  request: FillPixelsRequest,
): Uint8ClampedArray {
  const { width, height, color } = request;
  const mask = floodFillMask({
    ...request,
    options: { tolerance: request.tolerance },
  });
  const alpha = featherMask(mask, width, height, {
    radius: request.featherRadius,
  });
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < alpha.length; i++) {
    if (!alpha[i]) continue;
    const offset = i * 4;
    pixels[offset] = color.r;
    pixels[offset + 1] = color.g;
    pixels[offset + 2] = color.b;
    pixels[offset + 3] = alpha[i];
  }
  return pixels;
}
