import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { initializeWasm } from "@automerge/automerge/slim";

export async function initializeAutomergeBinary(): Promise<void> {
  await initializeWasm(
    await readFile(
      fileURLToPath(import.meta.resolve("@automerge/automerge/automerge.wasm")),
    ),
  );
}
