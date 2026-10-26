import { extractColoringPageId, getColoringPages } from "./catalog";
import { publishedColoringAssetUrl } from "./publishedAssets";

const previewSources = new Set(
  getColoringPages().map((page) => page.previewSrc),
);

export function createColoringAssetUrlResolver(
  assetBaseUrl: string | undefined,
  publishedBaseUrl?: string,
): (src: string) => string {
  const windowOrigin =
    typeof window !== "undefined" && window.location.origin !== "null"
      ? window.location.origin
      : undefined;
  const baseUrl = assetBaseUrl ?? windowOrigin;
  return (src) => {
    const coloringPageId =
      src === "coloring/credits/credits.txt" || previewSources.has(src)
        ? src
        : extractColoringPageId(src);
    if (!coloringPageId) {
      return src;
    }
    if (publishedBaseUrl)
      return publishedColoringAssetUrl(coloringPageId, publishedBaseUrl);
    if (!baseUrl) {
      return `/${coloringPageId}`;
    }
    return new URL(coloringPageId, `${baseUrl.replace(/\/+$/, "")}/`).href;
  };
}
