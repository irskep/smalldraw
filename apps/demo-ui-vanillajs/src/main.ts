import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { Repo } from "@automerge/automerge-repo/slim";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

import {
  createAutomergeStoreAdapter,
  type DrawingDocumentData,
  getDefaultShapeHandlerRegistry,
} from "@smalldraw/core";
import type { DrawingApp } from "@smalldraw/ui-vanillajs";

const DOC_URL_KEY = "smalldraw-demo-doc-url";
const DEBUG = true;

async function main(previousApp?: DrawingApp): Promise<DrawingApp | undefined> {
  previousApp?.destroy();

  const container = document.getElementById("app");
  if (!container) {
    console.error("Missing #app container");
    return undefined;
  }

  if (!isWasmInitialized()) {
    await initializeBase64Wasm(automergeWasmBase64);
  }

  const repo = new Repo({
    storage: new IndexedDBStorageAdapter(),
    network: [new BroadcastChannelNetworkAdapter()],
  });

  const registry = getDefaultShapeHandlerRegistry();

  async function getOrCreateHandle() {
    const storedUrl = localStorage.getItem(DOC_URL_KEY);
    if (DEBUG) {
      console.debug("[main] stored doc url", storedUrl);
    }
    if (storedUrl) {
      return await repo.find<DrawingDocumentData>(storedUrl as AutomergeUrl);
    }
    const handle = repo.create<DrawingDocumentData>({ shapes: {} });
    localStorage.setItem(DOC_URL_KEY, handle.url);
    if (DEBUG) {
      console.debug("[main] created doc url", handle.url);
    }
    return handle;
  }

  async function mount(target: HTMLElement): Promise<DrawingApp> {
    const handle = await getOrCreateHandle();
    await handle.whenReady();

    if (DEBUG) {
      console.debug("[main] repo peer", repo.peerId);
      console.debug("[main] handle ready", handle.url);
    }

    const storeAdapter = createAutomergeStoreAdapter({
      handle,
      registry,
      debug: DEBUG,
    });

    const { DrawingApp } = await import("@smalldraw/ui-vanillajs");

    target.innerHTML = "";
    const app = new DrawingApp({
      container: target,
      width: 960,
      height: 600,
      backgroundColor: "#ffffff",
      storeAdapter,
    });

    (window as unknown as { smalldrawApp?: DrawingApp }).smalldrawApp = app;
    return app;
  }

  let app = await mount(container);

  document.getElementById("reset")?.addEventListener("click", async () => {
    localStorage.removeItem(DOC_URL_KEY);
    app.destroy();
    app = await mount(container);
  });

  return app;
}

if (import.meta.hot) {
  main(import.meta.hot.data.app as DrawingApp | undefined).then((app) => {
    import.meta.hot.data.app = app;
  });
  import.meta.hot.accept();
} else {
  main();
}
