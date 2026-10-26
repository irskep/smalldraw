import versions from "./assetVersions.json";

/** Version each collection, keeping the browser's URL table small. */
export function publishedColoringAssetUrl(
  src: string,
  baseUrl: string,
): string {
  const match = /^\/?coloring\/([^/]+)\/([^/]+)$/.exec(src);
  if (!match || match[2] === "." || match[2] === "..")
    throw new Error(`Invalid coloring asset: ${src}`);
  const [, collection, filename] = match;
  const version = Object.prototype.hasOwnProperty.call(versions, collection)
    ? (versions as Record<string, string>)[collection]
    : undefined;
  if (!version)
    throw new Error(`Unpublished coloring collection: ${collection}`);
  return new URL(
    `coloring/${collection}/${version}/${filename}`,
    `${baseUrl.replace(/\/+$/, "")}/`,
  ).href;
}
