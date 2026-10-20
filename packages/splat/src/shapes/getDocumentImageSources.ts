import { isImmutableString } from "@automerge/automerge/slim";
import {
  type AnyShape,
  type DrawingDocument,
  getOrderedLayers,
  getOrderedShapes,
} from "@smalldraw/core";

export function getDocumentImageSources(
  doc: DrawingDocument,
  shapes: readonly AnyShape[] = getOrderedShapes(doc),
): string[] {
  const sources = new Set<string>();
  const layers = getOrderedLayers(doc);
  const visibleLayers = new Set(
    layers.filter((layer) => layer.visible !== false).map((layer) => layer.id),
  );
  for (const layer of layers) {
    if (layer.visible !== false && layer.kind === "image" && layer.image?.src)
      sources.add(layer.image.src);
  }
  for (const shape of shapes) {
    if (!visibleLayers.has(shape.layerId ?? "default")) continue;
    const geometry = shape.geometry;
    if (
      "src" in geometry &&
      (typeof geometry.src === "string" || isImmutableString(geometry.src))
    )
      sources.add(geometry.src.toString());
  }
  return [...sources];
}
