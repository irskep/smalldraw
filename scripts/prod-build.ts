import { $ } from "bun";

const deployHost = process.env.DEPLOY_HOST;
if (!deployHost) {
  throw new Error("DEPLOY_HOST is required (e.g. splatterboard.fly.dev)");
}

// Build splat-web (paint app) with prod env vars baked in
await $`SPLATTERBOARD_PUBLIC_SYNC_SERVER_HTTP_URL=https://${deployHost}/api/v1 SPLATTERBOARD_PUBLIC_SYNC_SERVER_WEBSOCKET_URL=wss://${deployHost} SPLATTERBOARD_PUBLIC_JOIN_BASE_URL=https://${deployHost}/draw/ SPLATTERBOARD_PUBLIC_ASSET_BASE_URL=https://${deployHost}/draw bun run --cwd apps/splat-web build`;

// Build portal as the root document home
await $`VITE_API_URL=https://${deployHost}/api/v1 VITE_BASE=/ bun run --cwd apps/app build`;

// Assemble into server build directory
await $`rm -rf apps/server/build`;
await $`mkdir -p apps/server/build/draw`;
await $`cp -R apps/app/dist/. apps/server/build/`;
await $`cp -R apps/splat-web/dist/. apps/server/build/draw/`;
