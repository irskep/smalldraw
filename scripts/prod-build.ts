import { $ } from "bun";

await $`bun run --cwd apps/app build`;
await $`rm -rf apps/server/public`;
await $`mkdir -p apps/server/public`;
await $`cp -R apps/app/dist/. apps/server/public/`;
