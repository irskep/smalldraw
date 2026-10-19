import wasmUrl from "@automerge/automerge/automerge.wasm" with { type: "file" };
import { initializeWasm } from "@automerge/automerge/slim";

export async function initializeAutomergeBinary(): Promise<void> {
  // Bun's dev server emits root-relative assets but retains a file: import.meta.url.
  // Built chunks emit relative assets, which must resolve beside the chunk.
  const base = wasmUrl.startsWith("/") ? window.location.href : import.meta.url;
  const response = await fetch(new URL(wasmUrl, base));
  if (!response.ok) {
    throw new Error(
      `Could not load the drawing engine (${response.status}). Please reload to try again.`,
    );
  }
  await initializeWasm(new Uint8Array(await response.arrayBuffer()));
}
