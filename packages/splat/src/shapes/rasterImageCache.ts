type CacheEntry = HTMLImageElement | HTMLCanvasElement;
type ImageSourceResolver = (src: string) => string;

const imageCache = new Map<string, CacheEntry>();
const failedImageSources = new Map<string, number>();
const IMAGE_RETRY_DELAY_MS = 5000;
const deferredLoadListeners = new Set<() => void>();
let imageSourceResolver: ImageSourceResolver = (src) => src;

export function configureRasterImageSourceResolver(
  resolver: ImageSourceResolver,
): void {
  imageSourceResolver = resolver;
}

export function resolveRasterImageSource(src: string): string {
  return imageSourceResolver(src);
}

/**
 * Register a callback that fires whenever a deferred image finishes loading.
 * Returns a dispose function to unregister the listener.
 */
export function onDeferredImageLoaded(listener: () => void): () => void {
  deferredLoadListeners.add(listener);
  return () => {
    deferredLoadListeners.delete(listener);
  };
}

const isImageReady = (image: CacheEntry): boolean => {
  if ("naturalWidth" in image) {
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }
  return image.width > 0 && image.height > 0;
};

export function getLoadedRasterImage(src: string): CacheEntry | null {
  const failedAt = failedImageSources.get(src);
  if (failedAt !== undefined) {
    if (Date.now() - failedAt < IMAGE_RETRY_DELAY_MS) return null;
    failedImageSources.delete(src);
  }

  const cached = imageCache.get(src);
  if (cached) {
    return isImageReady(cached) ? cached : null;
  }

  if (typeof Image !== "function") {
    return null;
  }

  const image = new Image();
  image.decoding = "async";
  image.crossOrigin = "anonymous";
  image.onload = () => {
    if (imageCache.get(src) !== image) return;
    image.onload = null;
    image.onerror = null;
    for (const listener of deferredLoadListeners) {
      listener();
    }
  };
  image.onerror = () => {
    if (imageCache.get(src) !== image) return;
    image.onload = null;
    image.onerror = null;
    imageCache.delete(src);
    failedImageSources.set(src, Date.now());
  };
  imageCache.set(src, image);
  image.src = resolveRasterImageSource(src);
  return isImageReady(image) ? image : null;
}

export function registerRasterImage(src: string, image: CacheEntry): void {
  failedImageSources.delete(src);
  imageCache.set(src, image);
}

export function warmRasterImage(src: string): void {
  getLoadedRasterImage(src);
}

export function warmRasterImages(sources: readonly string[]): void {
  for (const src of sources) {
    warmRasterImage(src);
  }
}

/** Reset all internal state. For testing only. */
export function resetRasterImageCache(): void {
  imageCache.clear();
  failedImageSources.clear();
  deferredLoadListeners.clear();
  imageSourceResolver = (src) => src;
}
