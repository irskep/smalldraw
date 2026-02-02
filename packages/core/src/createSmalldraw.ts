import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim";
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { Repo as RepoClass } from "@automerge/automerge-repo/slim";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

import { createAutomergeStoreAdapter } from "./automerge/storeAdapter";
import type { DrawingDocumentData } from "./model/document";
import { getDefaultShapeHandlerRegistry } from "./model/shapeHandlers";
import type { ShapeHandlerRegistry } from "./model/shapeHandlers";
import type { DrawingStoreAdapter } from "./store/drawingStore";

export interface SmalldrawCoreOptions {
  persistence?: {
    storageKey: string;
    mode: "reuse" | "always-new";
  };
  debug?: boolean;
}

export interface SmalldrawCore {
  repo: Repo;
  handle: DocHandle<DrawingDocumentData>;
  registry: ShapeHandlerRegistry;
  storeAdapter: DrawingStoreAdapter;
  reset(): Promise<DrawingStoreAdapter>;
  destroy(): void;
}

async function initAutomerge(): Promise<void> {
  if (!isWasmInitialized()) {
    await initializeBase64Wasm(automergeWasmBase64);
  }
}

function createRepo(): Repo {
  return new RepoClass({
    storage: new IndexedDBStorageAdapter(),
    network: [new BroadcastChannelNetworkAdapter()],
  });
}

async function getOrCreateHandle(
  repo: Repo,
  storageKey: string,
  mode: "reuse" | "always-new",
  debug: boolean,
): Promise<DocHandle<DrawingDocumentData>> {
  if (mode === "always-new") {
    const handle = repo.create<DrawingDocumentData>({ shapes: {} });
    if (debug) {
      console.debug("[createSmalldraw] created new doc (always-new):", handle.url);
    }
    return handle;
  }

  const storedUrl = localStorage.getItem(storageKey);
  if (debug) {
    console.debug("[createSmalldraw] stored doc url:", storedUrl);
  }

  if (storedUrl) {
    return await repo.find<DrawingDocumentData>(storedUrl as AutomergeUrl);
  }

  const handle = repo.create<DrawingDocumentData>({ shapes: {} });
  localStorage.setItem(storageKey, handle.url);
  if (debug) {
    console.debug("[createSmalldraw] created new doc:", handle.url);
  }
  return handle;
}

export async function createSmalldraw(
  options: SmalldrawCoreOptions = {},
): Promise<SmalldrawCore> {
  const { persistence, debug = false } = options;

  await initAutomerge();

  const repo = createRepo();
  const registry = getDefaultShapeHandlerRegistry();

  const storageKey = persistence?.storageKey ?? "smalldraw-doc-url";
  const mode = persistence?.mode ?? "reuse";

  let handle = await getOrCreateHandle(repo, storageKey, mode, debug);
  await handle.whenReady();

  if (debug) {
    console.debug("[createSmalldraw] repo peer:", repo.peerId);
    console.debug("[createSmalldraw] handle ready:", handle.url);
  }

  let storeAdapter = createAutomergeStoreAdapter({
    handle,
    registry,
    debug,
  });

  return {
    repo,
    registry,
    get handle() {
      return handle;
    },
    get storeAdapter() {
      return storeAdapter;
    },
    async reset() {
      localStorage.removeItem(storageKey);
      handle = await getOrCreateHandle(repo, storageKey, "always-new", debug);
      await handle.whenReady();
      storeAdapter = createAutomergeStoreAdapter({
        handle,
        registry,
        debug,
      });
      return storeAdapter;
    },
    destroy() {
      // Reserved for future teardown (e.g. closing adapters).
    },
  };
}
