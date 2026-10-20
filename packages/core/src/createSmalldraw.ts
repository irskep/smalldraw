import { isWasmInitialized, save } from "@automerge/automerge/slim";
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
  /** Pre-import document binaries into the repo before opening. */
  preImports?: Array<{
    binary: Uint8Array;
    docId: string;
  }>;
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
  createDocumentCopy(existingUrl?: string): { url: string; binary: Uint8Array };
  destroy(): void;
}

let wasmInitialization: Promise<void> | undefined;
export async function initAutomerge(): Promise<void> {
  if (isWasmInitialized()) return;
  wasmInitialization ??= import("#automerge-wasm")
    .then(({ initializeAutomergeBinary }) => initializeAutomergeBinary())
    .catch((error) => {
      wasmInitialization = undefined;
      throw error;
    });
  await wasmInitialization;
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

  return await findDocument(repo, currentDocUrl, findTimeoutMs);
}

export async function createSmalldraw(
  options: SmalldrawCoreOptions,
): Promise<SmalldrawCore> {
  const {
    repo,
    shapeHandlers,
    persistence,
    preImports = [],
    documentSize = DEFAULT_DOCUMENT_SIZE,
    debug = false,
    initialOpenTimeoutMs = 8000,
  } = options;

  if (!shapeHandlers) {
    throw new Error("createSmalldraw requires shapeHandlers");
  }

  await initAutomerge();

  for (const preImport of preImports) {
    const docId = stripAutomergePrefix(preImport.docId);
    // Load the durable local history before merging a server snapshot.
    // Importing into a fresh handle would otherwise replace unsynced offline edits.
    if (await repo.storageSubsystem?.loadDoc(docId)) await repo.find(docId);
    const imported = repo.import(preImport.binary, { docId });
    await imported.whenReady();
    // Import can emit its first change before the repo attaches its save listener.
    // Persist the snapshot before presenting a drawing as available on this device.
    await repo.flush([docId]);
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
  if (!initialReady) {
    throw new Error(`Timed out opening document: ${initialCurrentDocUrl}`);
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
      const nextHandle = await findDocument(repo, url, initialOpenTimeoutMs);
      if (!(await waitForHandleReady(nextHandle, initialOpenTimeoutMs))) {
        throw new Error(`Timed out opening document: ${url}`);
      }
      await writeCurrentDocUrl(nextHandle.url);
      const nextAdapter = createAutomergeStoreAdapter({
        handle: nextHandle,
        registry,
        debug,
      });
      handle = nextHandle;
      storeAdapter = nextAdapter;
      return storeAdapter;
    },
    createDocumentCopy(existingUrl) {
      const sourceDoc = storeAdapter.getDoc();
      const copyHandle = existingUrl
        ? (repo.handles[stripAutomergePrefix(existingUrl)] as
            | DocHandle<DrawingDocumentData>
            | undefined)
        : repo.create<DrawingDocumentData>();
      if (!copyHandle?.isReady()) throw new Error("Document copy is not ready");
      copyHandle.change((doc) => {
        doc.size = {
          width: sourceDoc.size.width,
          height: sourceDoc.size.height,
        };
        doc.presentation = sourceDoc.presentation
          ? { ...sourceDoc.presentation }
          : ({} as DrawingDocumentPresentation);
        doc.layers = JSON.parse(JSON.stringify(sourceDoc.layers ?? {}));
        if (!doc.shapes) doc.shapes = {};
        const sourceShapes = sourceDoc.shapes ?? {};
        // Keep unchanged shape objects/history on a retry. Replacing the whole
        // map duplicates every point in the binary, even for a single new stroke.
        for (const id of Object.keys(doc.shapes)) {
          if (!(id in sourceShapes)) delete doc.shapes[id];
        }
        for (const [id, shape] of Object.entries(sourceShapes)) {
          const serialized = JSON.stringify(shape);
          if (JSON.stringify(doc.shapes[id]) !== serialized) {
            doc.shapes[id] = JSON.parse(serialized);
          }
        }
        doc.temporalOrderCounter = sourceDoc.temporalOrderCounter ?? 0;
      });
      const copiedDoc = copyHandle.doc();
      if (!copiedDoc) {
        throw new Error("Document copy was not available after creation");
      }
      const binary = save(copiedDoc);
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

async function findDocument(
  repo: Repo,
  url: string,
  timeoutMs: number,
): Promise<DocHandle<DrawingDocumentData>> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // An already-running repo lookup may ignore a later caller's signal.
    // Bound this wait too; a late result must never replace the current drawing.
    return await Promise.race([
      repo.find<DrawingDocumentData>(url as AutomergeUrl, {
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Timed out opening document: ${url}`));
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHandleReady(
  handle: DocHandle<DrawingDocumentData>,
  timeoutMs: number,
): Promise<boolean> {
  const abortController = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutHandle = setTimeout(() => {
        abortController.abort();
        resolve();
      }, timeoutMs);
    });
    try {
      await Promise.race([
        handle.whenReady(["ready"], { signal: abortController.signal }),
        timeoutPromise,
      ]);
    } catch (error) {
      if (!abortController.signal.aborted) {
        throw error;
      }
    }
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
