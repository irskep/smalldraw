import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import {
  initializeBase64Wasm,
  isWasmInitialized,
  save,
} from "@automerge/automerge/slim";
import type {
  AutomergeUrl,
  DocHandle,
  DocumentId,
  Repo,
} from "@automerge/automerge-repo";
import { createAutomergeStoreAdapter } from "./automerge/storeAdapter";
import {
  DEFAULT_DOCUMENT_PRESENTATION,
  DEFAULT_DOCUMENT_SIZE,
  type DrawingDocumentData,
  type DrawingDocumentPresentation,
  type DrawingDocumentSize,
  normalizeDocumentLayers,
} from "./model/document";
import type { ShapeHandlerRegistry } from "./model/shapeHandlers";
import type { DrawingStoreAdapter } from "./store/drawingStore";

export interface SmalldrawCoreOptions {
  repo: Repo;
  shapeHandlers: ShapeHandlerRegistry;
  initialOpenTimeoutMs?: number;
  persistence?: {
    storageKey?: string;
    mode?: "reuse" | "always-new";
    getCurrentDocUrl?: () => Promise<string | null> | string | null;
    setCurrentDocUrl?: (url: string) => Promise<void> | void;
    clearCurrentDocUrl?: () => Promise<void> | void;
  };
  /** Pre-import a document binary into the repo before opening. */
  preImport?: {
    binary: Uint8Array;
    docId: string;
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
    documentPresentation?: DrawingDocumentPresentation;
  }): Promise<{ url: string; adapter: DrawingStoreAdapter }>;
  reset(options?: {
    documentSize?: DrawingDocumentSize;
    documentPresentation?: DrawingDocumentPresentation;
  }): Promise<DrawingStoreAdapter>;
  createDocumentCopy(): { url: string; binary: Uint8Array };
  destroy(): void;
}

async function initAutomerge(): Promise<void> {
  if (!isWasmInitialized()) {
    await initializeBase64Wasm(automergeWasmBase64);
  }
}

async function getOrCreateHandle(
  repo: Repo,
  currentDocUrl: string | null,
  mode: "reuse" | "always-new",
  documentSize: DrawingDocumentSize,
  documentPresentation: DrawingDocumentPresentation,
  debug: boolean,
  findTimeoutMs: number,
): Promise<DocHandle<DrawingDocumentData>> {
  if (mode === "always-new" || !currentDocUrl) {
    const handle = repo.create<DrawingDocumentData>(
      createEmptyDrawingDocumentData(documentSize, documentPresentation),
    );
    if (debug) {
      console.debug(
        "[createSmalldraw] created new doc:",
        handle.url,
        mode === "always-new" ? "(always-new)" : "(no stored url)",
      );
    }
    return handle;
  }

  if (debug) {
    console.debug("[createSmalldraw] stored doc url:", currentDocUrl);
  }

  // Check handle cache first — pre-imported docs will be here already.
  const docId = stripAutomergePrefix(currentDocUrl);
  const cachedHandle = repo.handles[docId] as
    | DocHandle<DrawingDocumentData>
    | undefined;
  if (cachedHandle) {
    if (debug) {
      console.debug("[createSmalldraw] found cached handle:", cachedHandle.url);
    }
    return cachedHandle;
  }

  // Not in cache — load from storage via repo.find().
  // Use an abort signal so we don't hang forever if the doc doesn't exist.
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), findTimeoutMs);
  try {
    return await repo.find<DrawingDocumentData>(currentDocUrl as AutomergeUrl, {
      signal: abortController.signal,
    });
  } catch {
    console.warn(
      "[createSmalldraw] repo.find failed or timed out, creating new:",
      currentDocUrl,
    );
    return repo.create<DrawingDocumentData>(
      createEmptyDrawingDocumentData(documentSize, documentPresentation),
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function createSmalldraw(
  options: SmalldrawCoreOptions,
): Promise<SmalldrawCore> {
  const {
    repo,
    shapeHandlers,
    persistence,
    preImport,
    documentSize = DEFAULT_DOCUMENT_SIZE,
    debug = false,
    initialOpenTimeoutMs = 8000,
  } = options;

  if (!shapeHandlers) {
    throw new Error("createSmalldraw requires shapeHandlers");
  }

  await initAutomerge();

  if (preImport) {
    const docId = stripAutomergePrefix(preImport.docId);
    repo.import(preImport.binary, { docId });
    if (debug) {
      console.debug("[createSmalldraw] pre-imported doc:", preImport.docId, {
        bytes: preImport.binary.length,
      });
    }
  }

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
    DEFAULT_DOCUMENT_PRESENTATION,
    debug,
    initialOpenTimeoutMs,
  );
  const initialReady = await waitForHandleReady(handle, initialOpenTimeoutMs);
  if (!initialReady && mode === "reuse" && initialCurrentDocUrl) {
    console.warn("[createSmalldraw] timed out opening stored doc; resetting", {
      initialCurrentDocUrl,
      timeoutMs: initialOpenTimeoutMs,
    });
    handle = await getOrCreateHandle(
      repo,
      null,
      "always-new",
      documentSize,
      DEFAULT_DOCUMENT_PRESENTATION,
      debug,
      initialOpenTimeoutMs,
    );
    await handle.whenReady();
  }
  await writeCurrentDocUrl(handle.url);

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
    documentPresentation?: DrawingDocumentPresentation;
  }): Promise<{ url: string; adapter: DrawingStoreAdapter }> => {
    const nextDocumentSize = createOptions?.documentSize ?? documentSize;
    const nextDocumentPresentation =
      createOptions?.documentPresentation ?? DEFAULT_DOCUMENT_PRESENTATION;
    handle = await getOrCreateHandle(
      repo,
      null,
      "always-new",
      nextDocumentSize,
      nextDocumentPresentation,
      debug,
      initialOpenTimeoutMs,
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
    createDocumentCopy() {
      const sourceDoc = storeAdapter.getDoc();
      const copyHandle = repo.create<DrawingDocumentData>();
      copyHandle.change((doc) => {
        doc.size = {
          width: sourceDoc.size.width,
          height: sourceDoc.size.height,
        };
        doc.presentation = sourceDoc.presentation
          ? { ...sourceDoc.presentation }
          : ({} as DrawingDocumentPresentation);
        doc.layers = JSON.parse(JSON.stringify(sourceDoc.layers ?? {}));
        doc.shapes = JSON.parse(JSON.stringify(sourceDoc.shapes ?? {}));
        doc.temporalOrderCounter = sourceDoc.temporalOrderCounter ?? 0;
      });
      const binary = save(copyHandle.doc()!);
      return { url: copyHandle.url, binary };
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

async function waitForHandleReady(
  handle: DocHandle<DrawingDocumentData>,
  timeoutMs: number,
): Promise<boolean> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      handle.whenReady(),
      new Promise<void>((resolve) => {
        timeoutHandle = setTimeout(resolve, timeoutMs);
      }),
    ]);
    return handle.isReady();
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
}

function stripAutomergePrefix(url: string): DocumentId {
  return url.replace(/^automerge:/, "") as DocumentId;
}

function createEmptyDrawingDocumentData(
  size: DrawingDocumentSize,
  presentation: DrawingDocumentPresentation,
): DrawingDocumentData {
  return {
    size: {
      width: Math.max(1, Math.round(size.width)),
      height: Math.max(1, Math.round(size.height)),
    },
    presentation,
    layers: normalizeDocumentLayers(undefined, presentation),
    shapes: {},
    temporalOrderCounter: 0,
  };
}
