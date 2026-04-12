import { existsSync } from "node:fs";
import { $ } from "bun";

await $`rm -rf dist`;
await $`mkdir -p dist`;
await $`bun build src/index.html --outdir dist --target=browser --env=SPLATTERBOARD_PUBLIC_*`;
if (existsSync("public")) {
  await $`cp -R public/. dist/`;
}
