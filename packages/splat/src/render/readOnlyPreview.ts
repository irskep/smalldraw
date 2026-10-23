import { free, load } from "@automerge/automerge/slim";
import {
  type DrawingDocumentData,
  getOrderedLayers,
  getOrderedShapes,
  initAutomerge,
} from "@smalldraw/core";
import { renderLayerStack } from "@smalldraw/renderer-canvas";

import { getDocumentImageSources } from "../shapes/getDocumentImageSources";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import {
  configureRasterImageSourceResolver,
  createRasterImageLease,
  getLoadedRasterImage,
  waitForRasterImage,
} from "../shapes/rasterImageCache";
import { createKidsShapeRendererRegistry } from "./kidsShapeRendererRegistry";

/** Admin previews must never fetch arbitrary URLs embedded in untrusted drawings. */
export function resolvePreviewImageSource(src: string, origin: string): string {
  if (/^data:image\/(png|webp|jpeg);base64,[a-z0-9+/=\s]+$/i.test(src))
    return src;
  const url = new URL(
    src.startsWith("coloring/") ? `/${src}` : src,
    `${origin}/draw/`,
  );
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    !/^\/(?:draw\/[^/]+\.(?:png|webp)|coloring\/[^?#]+\.(?:png|webp))$/.test(
      url.pathname,
    )
  ) {
    throw new Error("This drawing contains an unsupported image source.");
  }
  url.search = "";
  url.hash = "";
  return url.href;
}

/** A one-shot snapshot render: no repository, persistence, edits, or collaboration. */
export async function renderDrawingPreview(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<string> {
  await initAutomerge();
  signal?.throwIfAborted();
  const doc = load<DrawingDocumentData>(bytes);
  const images = createRasterImageLease();
  try {
    const { width, height } = doc.size;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    )
      throw new Error("This drawing has invalid dimensions.");
    const sources = getDocumentImageSources(doc);
    // Validate before warming anything; retain no document data in the global resolver.
    for (const src of sources)
      resolvePreviewImageSource(src, window.location.origin);
    configureRasterImageSourceResolver((src) =>
      resolvePreviewImageSource(src, window.location.origin),
    );
    images.update(sources);
    if (
      !(await Promise.all(sources.map((src) => waitForRasterImage(src)))).every(
        Boolean,
      )
    )
      throw new Error("Some drawing images could not load. Try again.");
    signal?.throwIfAborted();
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("Drawing preview is unavailable in this browser.");
    ctx.scale(scale, scale);
    renderLayerStack(ctx, getOrderedLayers(doc), getOrderedShapes(doc), {
      registry: createKidsShapeRendererRegistry(),
      geometryHandlerRegistry: createKidsShapeHandlerRegistry(),
      resolveImage: (src) => getLoadedRasterImage(src),
      documentWidth: width,
      documentHeight: height,
    });
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    images.dispose();
    free(doc);
  }
}
