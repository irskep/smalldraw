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
import {
  DEFAULT_DOCUMENT_SIZE,
  type DrawingDocumentData,
  type DrawingDocumentSize,
} from "./model/document";
import type { ShapeHandlerRegistry } from "./model/shapeHandlers";
import type { DrawingStoreAdapter } from "./store/drawingStore";

export interface SmalldrawCoreOptions {
  shapeHandlers: ShapeHandlerRegistry;
  persistence?: {
    storageKey?: string;
    mode?: "reuse" | "always-new";
    getCurrentDocUrl?: () => Promise<string | null> | string | null;
    setCurrentDocUrl?: (url: string) => Promise<void> | void;
    clearCurrentDocUrl?: () => Promise<void> | void;
  };
  documentSize?: DrawingDocumentSize;
  debug?: boolean;
}

export interface SmalldrawCore {
  readonly storeAdapter: DrawingStoreAdapter;
  getCurrentDocUrl(): string;
  open(url: string): Promise<DrawingStoreAdapter>;
  createNew(options?: {
    documentSize?: DrawingDocumentSize;
  }): Promise<{ url: string; adapter: DrawingStoreAdapter }>;
  reset(options?: {
    documentSize?: DrawingDocumentSize;
  }): Promise<DrawingStoreAdapter>;
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
  currentDocUrl: string | null,
  mode: "reuse" | "always-new",
  documentSize: DrawingDocumentSize,
  debug: boolean,
): Promise<DocHandle<DrawingDocumentData>> {
  if (mode === "always-new") {
    const handle = repo.create<DrawingDocumentData>(
      createEmptyDrawingDocumentData(documentSize),
    );
    if (debug) {
      console.debug(
        "[createSmalldraw] created new doc (always-new):",
        handle.url,
      );
    }
    return handle;
  }

  if (debug) {
    console.debug("[createSmalldraw] stored doc url:", currentDocUrl);
  }

  if (currentDocUrl) {
    return await repo.find<DrawingDocumentData>(currentDocUrl as AutomergeUrl);
  }

  const handle = repo.create<DrawingDocumentData>(
    createEmptyDrawingDocumentData(documentSize),
  );
  if (debug) {
    console.debug("[createSmalldraw] created new doc:", handle.url);
  }
  return handle;
}

export async function createSmalldraw(
  options: SmalldrawCoreOptions,
): Promise<SmalldrawCore> {
  const {
    shapeHandlers,
    persistence,
    documentSize = DEFAULT_DOCUMENT_SIZE,
    debug = false,
  } = options;

  if (!shapeHandlers) {
    throw new Error("createSmalldraw requires shapeHandlers");
  }

  await initAutomerge();

  const repo = createRepo();
  const registry = shapeHandlers;

  const storageKey = persistence?.storageKey ?? "smalldraw-doc-url";
  const mode = persistence?.mode ?? "reuse";
  const readCurrentDocUrl = async (): Promise<string | null> => {
    if (persistence?.getCurrentDocUrl) {
      return (await persistence.getCurrentDocUrl()) ?? null;
    }
    return localStorage.getItem(storageKey);
  };
  const writeCurrentDocUrl = async (url: string): Promise<void> => {
    if (persistence?.setCurrentDocUrl) {
      await persistence.setCurrentDocUrl(url);
      return;
    }
    localStorage.setItem(storageKey, url);
  };
  const clearCurrentDocUrl = async (): Promise<void> => {
    if (persistence?.clearCurrentDocUrl) {
      await persistence.clearCurrentDocUrl();
      return;
    }
    localStorage.removeItem(storageKey);
  };

  const initialCurrentDocUrl = await readCurrentDocUrl();
  let handle = await getOrCreateHandle(
    repo,
    initialCurrentDocUrl,
    mode,
    documentSize,
    debug,
  );
  await writeCurrentDocUrl(handle.url);
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
  const createNewDocument = async (createOptions?: {
    documentSize?: DrawingDocumentSize;
  }): Promise<{ url: string; adapter: DrawingStoreAdapter }> => {
    const nextDocumentSize = createOptions?.documentSize ?? documentSize;
    handle = await getOrCreateHandle(
      repo,
      null,
      "always-new",
      nextDocumentSize,
      debug,
    );
    await handle.whenReady();
    await writeCurrentDocUrl(handle.url);
    storeAdapter = createAutomergeStoreAdapter({
      handle,
      registry,
      debug,
    });
    return {
      url: handle.url,
      adapter: storeAdapter,
    };
  };

  return {
    get storeAdapter() {
      return storeAdapter;
    },
    getCurrentDocUrl() {
      return handle.url;
    },
    async open(url) {
      handle = await repo.find<DrawingDocumentData>(url as AutomergeUrl);
      await handle.whenReady();
      await writeCurrentDocUrl(handle.url);
      storeAdapter = createAutomergeStoreAdapter({
        handle,
        registry,
        debug,
      });
      return storeAdapter;
    },
    async createNew(createOptions) {
      return await createNewDocument(createOptions);
    },
    async reset(resetOptions) {
      await clearCurrentDocUrl();
      const created = await createNewDocument(resetOptions);
      return created.adapter;
    },
    destroy() {
      // Reserved for future teardown (e.g. closing adapters).
    },
  };
}

function createEmptyDrawingDocumentData(
  size: DrawingDocumentSize,
): DrawingDocumentData {
  return {
    size: {
      width: Math.max(1, Math.round(size.width)),
      height: Math.max(1, Math.round(size.height)),
    },
    shapes: {},
    temporalOrderCounter: 0,
  };
}
