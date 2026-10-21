import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Both browser builds publish the exact same binary at the same cache key.
// /engine bypasses Fly statics so the app can set immutable cache headers.
const source = readFileSync(
  fileURLToPath(import.meta.resolve("@automerge/automerge/automerge.wasm")),
);
const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
export const automergeAsset = {
  source,
  fileName: `engine/automerge-${hash}.wasm`,
  url: `/engine/automerge-${hash}.wasm`,
};
