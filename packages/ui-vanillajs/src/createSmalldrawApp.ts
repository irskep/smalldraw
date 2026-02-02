import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim";
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { Repo as RepoClass } from "@automerge/automerge-repo/slim";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

import {
  createAutomergeStoreAdapter,
  type DrawingDocumentData,
  getDefaultShapeHandlerRegistry,
} from "@smalldraw/core";
import { DrawingApp, type DrawingAppOptions } from "./components/DrawingApp";

export interface SmalldrawAppOptions {
  container: HTMLElement;
  width: number;
  height: number;
  backgroundColor?: string;
  persistence?: {
    storageKey: string;
    mode: "reuse" | "always-new";
  };
  debug?: boolean;
}

export interface SmalldrawApp {
  readonly app: DrawingApp;
  destroy(): void;
  reset(): Promise<void>;
}

interface InternalState {
  repo: Repo;
  handle: DocHandle<DrawingDocumentData>;
  resizeObserver: ResizeObserver;
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
      console.debug(
        "[createSmalldrawApp] created new doc (always-new):",
        handle.url,
      );
    }
    return handle;
  }

  const storedUrl = localStorage.getItem(storageKey);
  if (debug) {
    console.debug("[createSmalldrawApp] stored doc url:", storedUrl);
  }

  if (storedUrl) {
    return await repo.find<DrawingDocumentData>(storedUrl as AutomergeUrl);
  }

  const handle = repo.create<DrawingDocumentData>({ shapes: {} });
  localStorage.setItem(storageKey, handle.url);
  if (debug) {
    console.debug("[createSmalldrawApp] created new doc:", handle.url);
  }
  return handle;
}

function computeScale(
  containerWidth: number,
  containerHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  maxScale = 1,
): number {
  const scaleX = containerWidth / viewportWidth;
  const scaleY = containerHeight / viewportHeight;
  // Cap at maxScale to prevent feedback loops when container grows with content
  return Math.min(scaleX, scaleY, maxScale);
}

export async function createSmalldrawApp(
  options: SmalldrawAppOptions,
): Promise<SmalldrawApp> {
  const {
    container,
    width: viewportWidth,
    height: viewportHeight,
    backgroundColor,
    persistence,
    debug = false,
  } = options;

  if (!container) {
    throw new Error("container is required");
  }

  await initAutomerge();

  const repo = createRepo();
  const registry = getDefaultShapeHandlerRegistry();

  const storageKey = persistence?.storageKey ?? "smalldraw-doc-url";
  const mode = persistence?.mode ?? "reuse";

  const handle = await getOrCreateHandle(repo, storageKey, mode, debug);
  await handle.whenReady();

  if (debug) {
    console.debug("[createSmalldrawApp] repo peer:", repo.peerId);
    console.debug("[createSmalldrawApp] handle ready:", handle.url);
  }

  const storeAdapter = createAutomergeStoreAdapter({
    handle,
    registry,
    debug,
  });

  container.innerHTML = "";

  // Compute initial scale from container dimensions
  const containerRect = container.getBoundingClientRect();
  const initialScale =
    containerRect.width > 0 && containerRect.height > 0
      ? computeScale(
          containerRect.width,
          containerRect.height,
          viewportWidth,
          viewportHeight,
        )
      : 1;
  const initialWidth = viewportWidth * initialScale;
  const initialHeight = viewportHeight * initialScale;

  const appOptions: DrawingAppOptions = {
    container,
    width: viewportWidth,
    height: viewportHeight,
    backgroundColor,
    storeAdapter,
    scale: initialScale,
    initialCanvasWidth: initialWidth,
    initialCanvasHeight: initialHeight,
  };

  const app = new DrawingApp(appOptions);

  // Set up viewport scaling with ResizeObserver for subsequent resizes
  let resizeRafId: number | null = null;
  let lastScale = initialScale;

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;

    const { width: containerWidth, height: containerHeight } =
      entry.contentRect;
    if (containerWidth === 0 || containerHeight === 0) return;

    const scale = computeScale(
      containerWidth,
      containerHeight,
      viewportWidth,
      viewportHeight,
    );

    // Skip if scale hasn't changed (avoids unnecessary rerenders)
    if (scale === lastScale) return;

    // Defer to next frame to avoid ResizeObserver loop warnings
    if (resizeRafId !== null) {
      cancelAnimationFrame(resizeRafId);
    }

    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null;
      const scaledWidth = viewportWidth * scale;
      const scaledHeight = viewportHeight * scale;

      app.resize(scaledWidth, scaledHeight);
      app.setScale(scale);
      lastScale = scale;
    });
  });

  resizeObserver.observe(container);

  const state: InternalState = {
    repo,
    handle,
    resizeObserver,
  };

  const result: SmalldrawApp = {
    get app() {
      return app;
    },

    destroy() {
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
        resizeRafId = null;
      }
      state.resizeObserver.disconnect();
      app.destroy();
    },

    async reset() {
      localStorage.removeItem(storageKey);
      const newHandle = await getOrCreateHandle(
        repo,
        storageKey,
        "always-new",
        debug,
      );
      await newHandle.whenReady();
      state.handle = newHandle;

      const newAdapter = createAutomergeStoreAdapter({
        handle: newHandle,
        registry,
        debug,
      });

      app.resetWithAdapter(newAdapter);
    },
  };

  return result;
}
