type CacheEntry = HTMLImageElement | HTMLCanvasElement;
type ImageSourceResolver = (src: string) => string;

const imageCache = new Map<string, CacheEntry>();
const failedImageSources = new Map<string, number>();
const IMAGE_RETRY_DELAY_MS = 5000;
// Active documents and exports may exceed this budget. Only unused assets are
// evictable: evicting visible images would cause a load/invalidate/reload loop.
const UNUSED_IMAGE_BYTES = 32 * 1024 * 1024;
const UNUSED_IMAGE_COUNT = 32;
const retainedSources = new Map<string, number>();

function removeCachedImage(src: string): void {
  const image = imageCache.get(src);
  if (image && "naturalWidth" in image) {
    image.onload = null;
    image.onerror = null;
  }
  imageCache.delete(src);
}

function pruneUnusedImages(): void {
  let count = 0;
  let bytes = 0;
  // Map order is least to most recently used. Keep the newest unused assets.
  for (const [src, image] of [...imageCache].reverse()) {
    if (retainedSources.has(src)) continue;
    const width = "naturalWidth" in image ? image.naturalWidth : image.width;
    const height =
      "naturalHeight" in image ? image.naturalHeight : image.height;
    bytes += width * height * 4 + src.length * 2;
    if (++count > UNUSED_IMAGE_COUNT || bytes > UNUSED_IMAGE_BYTES)
      removeCachedImage(src);
  }
  while (failedImageSources.size > UNUSED_IMAGE_COUNT) {
    const oldest = failedImageSources.keys().next().value;
    if (oldest === undefined) break;
    failedImageSources.delete(oldest);
  }
}

/** Own decoded assets for a document or async render; release on disposal. */
export function createRasterImageLease(): {
  update(sources: Iterable<string>): void;
  dispose(): void;
} {
  let owned = new Set<string>();
  const update = (sources: Iterable<string>) => {
    const next = new Set(sources);
    for (const src of next) {
      if (!owned.has(src))
        retainedSources.set(src, (retainedSources.get(src) ?? 0) + 1);
    }
    for (const src of owned) {
      if (next.has(src)) continue;
      const count = (retainedSources.get(src) ?? 1) - 1;
      if (count > 0) retainedSources.set(src, count);
      else {
        retainedSources.delete(src);
        removeCachedImage(src);
        failedImageSources.delete(src);
      }
    }
    owned = next;
    pruneUnusedImages();
  };
  return { update, dispose: () => update([]) };
}

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
    if (!retainedSources.has(src)) {
      imageCache.delete(src);
      imageCache.set(src, cached);
    }
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
    pruneUnusedImages();
  };
  image.onerror = () => {
    if (imageCache.get(src) !== image) return;
    image.onload = null;
    image.onerror = null;
    imageCache.delete(src);
    failedImageSources.set(src, Date.now());
    notifySettlement(src);
    pruneUnusedImages();
  };
  imageCache.set(src, image);
  image.src = resolveRasterImageSource(src);
  pruneUnusedImages();
  return isImageReady(image) ? image : null;
}

export function registerRasterImage(src: string, image: CacheEntry): void {
  failedImageSources.delete(src);
  removeCachedImage(src);
  imageCache.set(src, image);
  notifySettlement(src);
  pruneUnusedImages();
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
  for (const src of imageCache.keys()) removeCachedImage(src);
  retainedSources.clear();
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
  retainedSources.set(src, (retainedSources.get(src) ?? 0) + 1);
  return new Promise((resolve) => {
    const listeners = settlementListeners.get(src) ?? new Set<() => void>();
    settlementListeners.set(src, listeners);
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      listeners.delete(onSettled);
      if (listeners.size === 0) settlementListeners.delete(src);
      const count = (retainedSources.get(src) ?? 1) - 1;
      if (count > 0) retainedSources.set(src, count);
      else retainedSources.delete(src);
      resolve(ready);
      pruneUnusedImages();
    };
    const onSettled = () => finish(!!getLoadedRasterImage(src));
    const timer = setTimeout(() => finish(false), timeoutMs);
    listeners.add(onSettled);
  });
}
