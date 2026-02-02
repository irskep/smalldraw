// Import various automerge things
import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim";
import type { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { Repo } from "@automerge/automerge-repo/slim";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

// Import smalldraw things
import {
  type ActionContext,
  applyActionToDoc,
  createDocument,
  type DrawingDocument,
  type DrawingDocumentData,
  type DrawingStoreActionEvent,
  getDefaultShapeHandlerRegistry,
} from "@smalldraw/core";
import type { DrawingApp, DrawingStoreAdapter } from "@smalldraw/ui-vanillajs";

// Get the DOM element we're going to be mounting in
const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

let app: DrawingApp | null = null;
const DOC_URL_KEY = "smalldraw-demo-doc-url";
const DEBUG_AUTOMERGE = true;

const repo = new Repo({
  storage: new IndexedDBStorageAdapter(),
  network: [new BroadcastChannelNetworkAdapter()],
});

const registry = getDefaultShapeHandlerRegistry();

const draftChange: ActionContext["change"] = (doc, update) => {
  update(doc as DrawingDocumentData);
  return doc;
};

const actionContext: ActionContext = {
  registry,
  change: draftChange,
};

const getHandle = async (): Promise<DocHandle<DrawingDocumentData>> => {
  const storedUrl = localStorage.getItem(DOC_URL_KEY);
  if (DEBUG_AUTOMERGE) {
    console.debug("[smalldraw][automerge] stored doc url", storedUrl);
  }
  if (storedUrl) {
    return await repo.find<DrawingDocumentData>(storedUrl as AutomergeUrl);
  }
  const handle = repo.create<DrawingDocumentData>({ shapes: {} });
  localStorage.setItem(DOC_URL_KEY, handle.url);
  if (DEBUG_AUTOMERGE) {
    console.debug("[smalldraw][automerge] created doc url", handle.url);
  }
  return handle;
};

const createStoreAdapter = (
  handle: DocHandle<DrawingDocumentData>,
): DrawingStoreAdapter => {
  return {
    getDoc: () => {
      try {
        const doc = handle.doc();
        return doc as DrawingDocument;
      } catch {
        return createDocument(undefined, registry);
      }
    },
    applyAction: (event: DrawingStoreActionEvent) => {
      if (!handle.isReady()) return;
      if (DEBUG_AUTOMERGE) {
        console.debug("[smalldraw][automerge] dispatch action", event.type);
      }
      handle.change((doc) => {
        if (event.type === "undo") {
          event.action.undo(doc as DrawingDocument, actionContext);
          return;
        }
        applyActionToDoc(
          doc as DrawingDocument,
          event.action,
          registry,
          draftChange,
        );
      });
    },
    subscribe: (listener) => {
      const onChange = (payload: { doc: DrawingDocument }) => {
        if (DEBUG_AUTOMERGE) {
          console.debug("[smalldraw][automerge] handle change", {
            url: handle.url,
            heads: handle.heads(),
          });
        }
        listener(payload.doc);
      };
      const onDelete = () => {
        if (DEBUG_AUTOMERGE) {
          console.debug("[smalldraw][automerge] handle delete", handle.url);
        }
        listener(createDocument(undefined, registry));
      };
      handle.on("change", onChange);
      handle.on("delete", onDelete);
      return () => {
        handle.off("change", onChange);
        handle.off("delete", onDelete);
      };
    },
  };
};

async function mount() {
  if (!container) return;
  if (!isWasmInitialized()) {
    await initializeBase64Wasm(automergeWasmBase64);
  }
  const handle = await getHandle();
  await handle.whenReady();
  if (DEBUG_AUTOMERGE) {
    console.debug("[smalldraw][automerge] repo peer", repo.peerId);
    console.debug("[smalldraw][automerge] handle ready", handle.url);
  }
  const storeAdapter = createStoreAdapter(handle);
  const { DrawingApp } = await import("@smalldraw/ui-vanillajs");
  container.innerHTML = "";
  app = new DrawingApp({
    container,
    width: 960,
    height: 600,
    backgroundColor: "#ffffff",
    storeAdapter,
  });
  (window as unknown as { smalldrawApp?: DrawingApp }).smalldrawApp = app;
}

const resetButton = document.getElementById("reset");
resetButton?.addEventListener("click", () => {
  localStorage.removeItem(DOC_URL_KEY);
  app?.destroy();
  void mount();
});

void mount();

import.meta.hot.accept();
