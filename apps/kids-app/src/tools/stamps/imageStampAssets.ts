import {
  getLoadedRasterImage,
  warmRasterImage,
} from "../../shapes/rasterImageCache";

export function getLoadedImageStampAsset(src: string): HTMLImageElement | null {
  const image = getLoadedRasterImage(src);
  if (!image || !("naturalWidth" in image)) {
    return null;
  }
  return image;
}

export function warmImageStampAsset(src: string): void {
  warmRasterImage(src);
}

export function warmImageStampAssets(sources: readonly string[]): void {
  for (const src of sources) {
    warmImageStampAsset(src);
  }
}
