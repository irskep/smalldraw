import { existsSync } from "node:fs";
import { $ } from "bun";

const coloringAssetsDir = "../../packages/splat/src/coloring/assets";

await $`rm -rf dist`;
await $`mkdir -p dist`;
await $`bun build src/index.html --outdir dist --target=browser --env='SPLATTERBOARD_PUBLIC_*'`;
if (existsSync("public")) {
  await $`cp -R public/. dist/`;
}

// Copy coloring page assets with stable paths (not content-hashed)
await $`rm -rf dist/coloring`;
await $`mkdir -p dist/coloring`;
for await (const entry of new Bun.Glob("*/page-*.png").scan({
  cwd: coloringAssetsDir,
  onlyFiles: true,
})) {
  const volumeId = entry.split("/")[0];
  await $`mkdir -p dist/coloring/${volumeId}`;
  await $`cp ${coloringAssetsDir}/${entry} dist/coloring/${entry}`;
}
