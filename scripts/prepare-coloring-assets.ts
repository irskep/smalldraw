import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const sourceRoot = "packages/splat/src/coloring/assets";
const outputRoot = ".coloring-assets";
export interface PublishedAsset {
  source: string;
  key: string;
  size: number;
  md5: string;
  contentType: string;
  contentEncoding?: string;
}

export async function prepareColoringAssets() {
  const files: string[] = [];
  for await (const file of new Bun.Glob(
    "*/{*.webp,*.svg,credits.txt,LICENSE,Acknowledgments.md}",
  ).scan({ cwd: sourceRoot, onlyFiles: true })) {
    const collection = file.split("/")[0];
    if (!collection.endsWith("-in") && !collection.endsWith("-input"))
      files.push(file);
  }
  files.sort();
  const groups = Map.groupBy(files, (file) => file.split("/")[0]);
  const versions: Record<string, string> = {};
  const entries: PublishedAsset[] = [];
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  for (const [collection, paths] of groups) {
    const hash = createHash("sha256").update("coloring-gzip-v1\0");
    const contents = new Map<string, Uint8Array>();
    for (const file of paths) {
      const original = await Bun.file(`${sourceRoot}/${file}`).bytes();
      const bytes = file.endsWith(".svg")
        ? gzipSync(original, { level: 9 })
        : original;
      contents.set(file, bytes);
      hash
        .update(file)
        .update("\0")
        .update(createHash("sha256").update(bytes).digest());
    }
    const version = hash.digest("hex").slice(0, 20);
    versions[collection] = version;
    for (const file of paths) {
      const filename = file.slice(collection.length + 1);
      const key = `coloring/${collection}/${version}/${filename}`;
      const source = `${sourceRoot}/${file}`;
      const isSvg = file.endsWith(".svg");
      const bytes = contents.get(file)!;
      const uploadSource = isSvg ? `${outputRoot}/${file}.gz` : source;
      if (isSvg) await Bun.write(uploadSource, bytes);
      entries.push({
        source: uploadSource,
        key,
        size: bytes.length,
        md5: createHash("md5").update(bytes).digest("hex"),
        contentType: isSvg
          ? "image/svg+xml"
          : file.endsWith(".webp")
            ? "image/webp"
            : "text/plain; charset=utf-8",
        ...(isSvg ? { contentEncoding: "gzip" } : {}),
      });
    }
  }
  const versionPath = "packages/splat/src/coloring/assetVersions.json";
  const json = JSON.stringify(versions, null, 2) + "\n";
  if (
    !(await Bun.file(versionPath).exists()) ||
    (await Bun.file(versionPath).text()) !== json
  )
    await Bun.write(versionPath, json);
  await Bun.write(
    `${outputRoot}/manifest.json`,
    JSON.stringify(entries, null, 2) + "\n",
  );
  console.log(
    `Prepared ${entries.length} assets in ${groups.size} immutable collections: ${(entries.reduce((sum, entry) => sum + entry.size, 0) / 1e6).toFixed(1)} MB`,
  );
  return entries;
}
if (import.meta.main) await prepareColoringAssets();
