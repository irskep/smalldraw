import { existsSync } from "node:fs";

import { $ } from "bun";

import { automergeAsset } from "../../../scripts/automerge-asset.mjs";

const coloringAssetsDir = "../../packages/splat/src/coloring/assets";

await $`rm -rf dist`;
await $`mkdir -p dist`;
const result = await Bun.build({
  entrypoints: ["src/index.html"],
  outdir: "dist",
  target: "browser",
  minify: true,
  splitting: true,
  env: "SPLATTERBOARD_PUBLIC_*",
  plugins: [
    {
      name: "shared-automerge-binary",
      setup(build) {
        build.onLoad({ filter: /automerge\.wasm$/ }, () => ({
          contents: `export default ${JSON.stringify(automergeAsset.url)};`,
          loader: "js",
        }));
      },
    },
  ],
});
if (!result.success)
  throw new AggregateError(result.logs, "Drawing build failed");
await Bun.write(`dist/${automergeAsset.fileName}`, automergeAsset.source);
await $`bun build ../../packages/splat/src/tools/fillWorker.ts --outfile dist/fill-worker.js --target=browser --minify`;
if (existsSync("public")) {
  await $`cp -R public/. dist/`;
}

// Copy coloring page assets with stable paths (not content-hashed)
await $`rm -rf dist/coloring`;
await $`mkdir -p dist/coloring`;
for await (const entry of new Bun.Glob(
  "*/{*.png,*.svg,credits.txt,LICENSE,Acknowledgments.md}",
).scan({
  cwd: coloringAssetsDir,
  onlyFiles: true,
})) {
  const volumeId = entry.split("/")[0];
  await $`mkdir -p dist/coloring/${volumeId}`;
  await $`cp ${coloringAssetsDir}/${entry} dist/coloring/${entry}`;
}
