import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Both browser builds publish the exact same binary at the same cache key.
const source = readFileSync(
  fileURLToPath(import.meta.resolve("@automerge/automerge/automerge.wasm")),
);
const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
export const automergeAsset = {
  source,
  fileName: `assets/automerge-${hash}.wasm`,
  url: `/assets/automerge-${hash}.wasm`,
};
