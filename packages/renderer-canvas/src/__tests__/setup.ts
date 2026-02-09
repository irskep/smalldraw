import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim";

if (!isWasmInitialized()) {
  await initializeBase64Wasm(automergeWasmBase64);
}
