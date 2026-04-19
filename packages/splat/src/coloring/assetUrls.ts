import { extractColoringPageId } from "./catalog";

export function createColoringAssetUrlResolver(
  assetBaseUrl: string | undefined,
): (src: string) => string {
  const windowOrigin =
    typeof window !== "undefined" && window.location.origin !== "null"
      ? window.location.origin
      : undefined;
  const baseUrl = assetBaseUrl ?? windowOrigin;
  return (src) => {
    const coloringPageId = extractColoringPageId(src);
    if (!coloringPageId) {
      return src;
    }
    if (!baseUrl) {
      return `/${coloringPageId}`;
    }
    return new URL(coloringPageId, `${baseUrl.replace(/\/+$/, "")}/`).href;
  };
}
