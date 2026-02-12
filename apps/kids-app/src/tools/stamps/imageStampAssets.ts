const imageCache = new Map<string, HTMLImageElement>();
const failedImageSources = new Set<string>();

const isImageReady = (image: HTMLImageElement): boolean =>
  image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;

export function getLoadedImageStampAsset(src: string): HTMLImageElement | null {
  if (failedImageSources.has(src)) {
    return null;
  }

  const cached = imageCache.get(src);
  if (cached && isImageReady(cached)) {
    return cached;
  }

  if (typeof Image !== "function") {
    return null;
  }

  const image = new Image();
  image.decoding = "async";
  image.onerror = () => {
    failedImageSources.add(src);
  };
  image.src = src;
  imageCache.set(src, image);
  return isImageReady(image) ? image : null;
}

export function warmImageStampAsset(src: string): void {
  getLoadedImageStampAsset(src);
}

export function warmImageStampAssets(sources: readonly string[]): void {
  for (const src of sources) {
    warmImageStampAsset(src);
  }
}
