import { computeFillPixels, type FillPixelsRequest } from "./fillPixels";

self.onmessage = (event: MessageEvent<FillPixelsRequest>) => {
  const pixels = computeFillPixels(event.data);
  self.postMessage(pixels, { transfer: [pixels.buffer] });
};
