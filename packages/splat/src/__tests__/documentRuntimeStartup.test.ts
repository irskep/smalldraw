import { describe, expect, test } from "bun:test";
import {
  createDocument,
  DrawingStore,
  type SmalldrawCore,
} from "@smalldraw/core";
import {
  createDocumentRuntimeController,
  DEFAULT_THUMBNAIL_SAVE_DEBOUNCE_MS,
} from "../controller/createDocumentRuntimeController";
import { createStartupReadinessStore } from "../controller/stores/createStartupReadinessStore";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";

async function waitForTurn(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitUntil(
  predicate: () => boolean,
  maxAttempts = 80,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i += 1) {
    if (predicate()) {
      return true;
    }
    await waitForTurn();
  }
  return predicate();
}

function createTestStore(withImageSrc?: string): DrawingStore {
  const shapeHandlers = createKidsShapeHandlerRegistry();
  const doc = createDocument(undefined, shapeHandlers, {
    width: 640,
    height: 480,
  });
  if (withImageSrc) {
    const mutable = doc as unknown as {
      layers: Record<string, unknown>;
      layerOrder: string[];
      activeLayerId: string;
    };
    mutable.layers = {
      base: {
        id: "base",
        kind: "image",
        zIndex: "a0",
        image: { src: withImageSrc },
      },
      drawing: {
        id: "drawing",
        kind: "drawing",
        zIndex: "a1",
      },
    };
    mutable.layerOrder = ["base", "drawing"];
    mutable.activeLayerId = "drawing";
  }

  return new DrawingStore({
    tools: [],
    document: doc,
    shapeHandlers,
    actionDispatcher: () => {},
  });
}

function createTestCore(store: DrawingStore): SmalldrawCore {
  return {
    storeAdapter: {
      getDoc: () => store.getDocument(),
      applyAction: () => {},
      subscribe: () => () => {},
    },
    getCurrentDocUrl: () => "automerge:test-1",
    open: async () => ({
      getDoc: () => store.getDocument(),
      applyAction: () => {},
      subscribe: () => () => {},
    }),
    createNew: async () => ({
      url: "automerge:test-2",
      adapter: {
        getDoc: () => store.getDocument(),
        applyAction: () => {},
        subscribe: () => () => {},
      },
    }),
    reset: async () => ({
      getDoc: () => store.getDocument(),
      applyAction: () => {},
      subscribe: () => () => {},
    }),
    createDocumentCopy: () => ({
      url: "automerge:copy-1",
      binary: new Uint8Array([1, 2, 3]),
    }),
    destroy: () => {},
  };
}

describe("createDocumentRuntimeController startup readiness", () => {
  test("keeps interaction disabled until first bake flush resolves", async () => {
    const store = createTestStore();
    const startupReadinessStore = createStartupReadinessStore();
    let resolveFlush!: () => void;
    const flushPromise = new Promise<void>((resolve) => {
      resolveFlush = resolve;
    });

    const controller = createDocumentRuntimeController({
      store,
      core: createTestCore(store),
      documentBackend: {
        mode: "local",
        listDocuments: async () => [],
        getDocument: async () => null,
        createDocument: async () => ({
          docUrl: "automerge:test-1",
          mode: "normal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        }),
        touchDocument: async () => ({
          docUrl: "automerge:test-1",
          mode: "normal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        }),
        deleteDocument: async () => {},
        saveThumbnail: async () => {},
        getThumbnail: async () => null,
        setCurrentDocument: async () => {},
        getCurrentDocument: async () => null,
      },
      snapshotService: {
        createThumbnailBlob: async () => null,
      },
      runtimeStore: {
        setDocumentLoading: () => {},
        setDocumentLoaded: () => {},
        setDocumentError: () => {},
        setNoDocument: () => {},
        getActiveDocumentDocUrl: () => null,
        isDestroyed: () => false,
      },
      startupReadinessStore,
      toolbarStateController: {
        applyToolbarStateForCurrentDocument: () => {},
        getCurrentToolbarSignature: () => "sig",
      },
      renderLoopController: {
        updateRenderIdentity: () => {},
        requestRenderFromModel: () => {},
      },
      pipeline: {
        setLayers: () => {},
        scheduleBakeForClear: () => {},
        bakePendingTiles: () => {},
        flushBakes: () => flushPromise,
      },
      syncToolbarUi: () => {},
      applyCanvasSize: () => {},
      getDocumentSizeFromViewport: () => ({ width: 640, height: 480 }),
      hasExplicitSize: false,
      getExplicitSize: () => ({ width: 640, height: 480 }),
      thumbnailSaveDebounceMs: DEFAULT_THUMBNAIL_SAVE_DEBOUNCE_MS,
    });

    controller.start();
    await waitForTurn();

    expect(startupReadinessStore.getState().interactionEnabled).toBeFalse();
    expect(startupReadinessStore.getState().phase).toBe("first_bake");

    resolveFlush();
    const becameReady = await waitUntil(
      () => startupReadinessStore.getState().phase === "ready",
    );
    expect(becameReady).toBeTrue();
    expect(startupReadinessStore.getState().interactionEnabled).toBeTrue();

    controller.dispose();
  });

  test("asset load success path reaches ready and reports progress", async () => {
    const originalImage = globalThis.Image;
    class SuccessImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      decoding = "async";

      set src(_value: string) {
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: SuccessImage,
    });

    try {
      const store = createTestStore("/ready-asset.png");
      const startupReadinessStore = createStartupReadinessStore();
      let flushCalls = 0;

      const controller = createDocumentRuntimeController({
        store,
        core: createTestCore(store),
        documentBackend: {
          mode: "local",
          listDocuments: async () => [],
          getDocument: async () => null,
          createDocument: async () => ({
            docUrl: "automerge:test-1",
            mode: "normal",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
          }),
          touchDocument: async () => ({
            docUrl: "automerge:test-1",
            mode: "normal",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
          }),
          deleteDocument: async () => {},
          saveThumbnail: async () => {},
          getThumbnail: async () => null,
          setCurrentDocument: async () => {},
          getCurrentDocument: async () => null,
        },
        snapshotService: {
          createThumbnailBlob: async () => null,
        },
        runtimeStore: {
          setDocumentLoading: () => {},
          setDocumentLoaded: () => {},
          setDocumentError: () => {},
          setNoDocument: () => {},
          getActiveDocumentDocUrl: () => null,
          isDestroyed: () => false,
        },
        startupReadinessStore,
        toolbarStateController: {
          applyToolbarStateForCurrentDocument: () => {},
          getCurrentToolbarSignature: () => "sig",
        },
        renderLoopController: {
          updateRenderIdentity: () => {},
          requestRenderFromModel: () => {},
        },
        pipeline: {
          setLayers: () => {},
          scheduleBakeForClear: () => {},
          bakePendingTiles: () => {},
          flushBakes: async () => {
            flushCalls += 1;
          },
        },
        syncToolbarUi: () => {},
        applyCanvasSize: () => {},
        getDocumentSizeFromViewport: () => ({ width: 640, height: 480 }),
        hasExplicitSize: false,
        getExplicitSize: () => ({ width: 640, height: 480 }),
      });

      controller.start();
      const becameReady = await waitUntil(
        () => startupReadinessStore.getState().phase === "ready",
      );

      expect(becameReady).toBeTrue();
      expect(startupReadinessStore.getState().assetsTotal).toBe(1);
      expect(startupReadinessStore.getState().assetsLoaded).toBe(1);
      expect(startupReadinessStore.getState().interactionEnabled).toBeTrue();
      expect(flushCalls).toBeGreaterThan(0);

      controller.dispose();
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: originalImage,
      });
    }
  });

  test("asset failure path enters degraded and still enables interaction", async () => {
    const originalImage = globalThis.Image;
    class FailureImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      decoding = "async";

      set src(_value: string) {
        setTimeout(() => {
          this.onerror?.();
        }, 0);
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: FailureImage,
    });

    try {
      const store = createTestStore("/failed-asset.png");
      const startupReadinessStore = createStartupReadinessStore();

      const controller = createDocumentRuntimeController({
        store,
        core: createTestCore(store),
        documentBackend: {
          mode: "local",
          listDocuments: async () => [],
          getDocument: async () => null,
          createDocument: async () => ({
            docUrl: "automerge:test-1",
            mode: "normal",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
          }),
          touchDocument: async () => ({
            docUrl: "automerge:test-1",
            mode: "normal",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString(),
          }),
          deleteDocument: async () => {},
          saveThumbnail: async () => {},
          getThumbnail: async () => null,
          setCurrentDocument: async () => {},
          getCurrentDocument: async () => null,
        },
        snapshotService: {
          createThumbnailBlob: async () => null,
        },
        runtimeStore: {
          setDocumentLoading: () => {},
          setDocumentLoaded: () => {},
          setDocumentError: () => {},
          setNoDocument: () => {},
          getActiveDocumentDocUrl: () => null,
          isDestroyed: () => false,
        },
        startupReadinessStore,
        toolbarStateController: {
          applyToolbarStateForCurrentDocument: () => {},
          getCurrentToolbarSignature: () => "sig",
        },
        renderLoopController: {
          updateRenderIdentity: () => {},
          requestRenderFromModel: () => {},
        },
        pipeline: {
          setLayers: () => {},
          scheduleBakeForClear: () => {},
          bakePendingTiles: () => {},
          flushBakes: async () => {},
        },
        syncToolbarUi: () => {},
        applyCanvasSize: () => {},
        getDocumentSizeFromViewport: () => ({ width: 640, height: 480 }),
        hasExplicitSize: false,
        getExplicitSize: () => ({ width: 640, height: 480 }),
      });

      controller.start();

      const becameDegraded = await waitUntil(
        () => startupReadinessStore.getState().phase === "degraded",
      );
      expect(becameDegraded).toBeTrue();
      expect(startupReadinessStore.getState().assetsFailed).toBe(1);
      expect(startupReadinessStore.getState().interactionEnabled).toBeTrue();

      controller.dispose();
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: originalImage,
      });
    }
  });

  test("share register failure surfaces error", async () => {
    const store = createTestStore();
    const startupReadinessStore = createStartupReadinessStore();

    const getStoreAdapter = () => ({
      getDoc: () => store.getDocument(),
      applyAction: () => {},
      subscribe: () => () => {},
    });

    const core: SmalldrawCore = {
      get storeAdapter() {
        return getStoreAdapter();
      },
      getCurrentDocUrl: () => "automerge:source-doc",
      open: async () => getStoreAdapter(),
      createNew: async () => ({
        url: "automerge:test-2",
        adapter: getStoreAdapter(),
      }),
      reset: async () => getStoreAdapter(),
      createDocumentCopy: () => ({
        url: "automerge:collab-doc",
        binary: new Uint8Array([1, 2, 3]),
      }),
      destroy: () => {},
    };

    const controller = createDocumentRuntimeController({
      store,
      core,
      documentBackend: {
        mode: "local",
        listDocuments: async () => [],
        getDocument: async (docUrl) => ({
          docUrl,
          mode: "normal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        }),
        createDocument: async (input) => ({
          docUrl: input.docUrl,
          mode: input.mode ?? "normal",
          collaborative: input.collaborative,
          collabDocUrl: input.collabDocUrl,
          joinSecret: input.joinSecret,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        }),
        touchDocument: async (docUrl) => ({
          docUrl,
          mode: "normal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        }),
        deleteDocument: async () => {},
        saveThumbnail: async () => {},
        getThumbnail: async () => null,
        setCurrentDocument: async () => {},
        getCurrentDocument: async () => null,
      },
      snapshotService: {
        createThumbnailBlob: async () => null,
      },
      runtimeStore: {
        setDocumentLoading: () => {},
        setDocumentLoaded: () => {},
        setDocumentError: () => {},
        setNoDocument: () => {},
        getActiveDocumentDocUrl: () => null,
        isDestroyed: () => false,
      },
      startupReadinessStore,
      toolbarStateController: {
        applyToolbarStateForCurrentDocument: () => {},
        getCurrentToolbarSignature: () => "sig",
      },
      renderLoopController: {
        updateRenderIdentity: () => {},
        requestRenderFromModel: () => {},
      },
      pipeline: {
        setLayers: () => {},
        scheduleBakeForClear: () => {},
        bakePendingTiles: () => {},
        flushBakes: async () => {},
      },
      syncToolbarUi: () => {},
      applyCanvasSize: () => {},
      getDocumentSizeFromViewport: () => ({ width: 640, height: 480 }),
      hasExplicitSize: false,
      getExplicitSize: () => ({ width: 640, height: 480 }),
      createDocumentCopy: () => ({
        url: "automerge:collab-doc",
        binary: new Uint8Array([1, 2, 3]),
      }),
      registerCollaborativeDocument: async () => {
        throw new Error("register failed");
      },
      resolveJoinBaseUrl: () => "https://splatterboard.app",
    });

    await expect(controller.shareCurrentDocument()).rejects.toThrow(
      "register failed",
    );
  });

  test("failed document switches block startup readiness interaction", async () => {
    const store = createTestStore();
    const startupReadinessStore = createStartupReadinessStore();
    const controller = createDocumentRuntimeController({
      store,
      core: {
        ...createTestCore(store),
        open: async () => {
          throw new Error("shared document bootstrap failed");
        },
      },
      documentBackend: {
        mode: "local",
        listDocuments: async () => [],
        getDocument: async () => ({
          docUrl: "catalog-collab:broken",
          collaborative: true,
          collabDocUrl: "automerge:broken",
          accountAttached: true,
          mode: "normal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        }),
        createDocument: async () => ({
          docUrl: "automerge:test-1",
          mode: "normal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        }),
        touchDocument: async () => ({
          docUrl: "automerge:test-1",
          mode: "normal",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        }),
        deleteDocument: async () => {},
        saveThumbnail: async () => {},
        getThumbnail: async () => null,
        setCurrentDocument: async () => {},
        getCurrentDocument: async () => null,
      },
      snapshotService: {
        createThumbnailBlob: async () => null,
      },
      runtimeStore: {
        setDocumentLoading: () => {},
        setDocumentLoaded: () => {},
        setDocumentError: () => {},
        setNoDocument: () => {},
        getActiveDocumentDocUrl: () => null,
        isDestroyed: () => false,
      },
      startupReadinessStore,
      toolbarStateController: {
        applyToolbarStateForCurrentDocument: () => {},
        getCurrentToolbarSignature: () => "sig",
      },
      renderLoopController: {
        updateRenderIdentity: () => {},
        requestRenderFromModel: () => {},
      },
      pipeline: {
        setLayers: () => {},
        scheduleBakeForClear: () => {},
        bakePendingTiles: () => {},
        flushBakes: async () => {},
      },
      syncToolbarUi: () => {},
      applyCanvasSize: () => {},
      getDocumentSizeFromViewport: () => ({ width: 640, height: 480 }),
      hasExplicitSize: false,
      getExplicitSize: () => ({ width: 640, height: 480 }),
    });

    await expect(
      controller.switchToDocument("catalog-collab:broken"),
    ).rejects.toThrow("shared document bootstrap failed");

    expect(startupReadinessStore.getState().phase).toBe("failed");
    expect(startupReadinessStore.getState().interactionEnabled).toBeFalse();
    expect(startupReadinessStore.getState().lastBlockingReason).toBe(
      "document_open_failed",
    );
  });
});
