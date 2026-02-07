import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim";
import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";

if (!isWasmInitialized()) {
  await initializeBase64Wasm(automergeWasmBase64);
}
