type CacheEntry = HTMLImageElement | HTMLCanvasElement;
type ImageSourceResolver = (src: string) => string;

const imageCache = new Map<string, CacheEntry>();
const failedImageSources = new Map<string, number>();
const IMAGE_RETRY_DELAY_MS = 5000;
const settlementListeners = new Map<string, Set<() => void>>();

function notifySettlement(src: string): void {
  for (const listener of settlementListeners.get(src) ?? []) listener();
}

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
    notifySettlement(src);
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
    notifySettlement(src);
  };
  imageCache.set(src, image);
  image.src = resolveRasterImageSource(src);
  return isImageReady(image) ? image : null;
}

export function registerRasterImage(src: string, image: CacheEntry): void {
  failedImageSources.delete(src);
  imageCache.set(src, image);
  notifySettlement(src);
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

/** Wait for the shared load; never export an image with missing raster content. */
export function waitForRasterImage(
  src: string,
  timeoutMs = 10000,
): Promise<boolean> {
  if (getLoadedRasterImage(src)) return Promise.resolve(true);
  if (failedImageSources.has(src) || !imageCache.has(src))
    return Promise.resolve(false);
  return new Promise((resolve) => {
    const listeners = settlementListeners.get(src) ?? new Set<() => void>();
    settlementListeners.set(src, listeners);
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      listeners.delete(onSettled);
      if (listeners.size === 0) settlementListeners.delete(src);
      resolve(ready);
    };
    const onSettled = () => finish(!!getLoadedRasterImage(src));
    const timer = setTimeout(() => finish(false), timeoutMs);
    listeners.add(onSettled);
  });
}
