import type {
  DrawingDocumentSize,
  DrawingLayer,
  DrawingStore,
  SmalldrawCore,
} from "@smalldraw/core";
import { getOrderedLayers as getOrderedLayersFromDoc } from "@smalldraw/core";
import { getColoringPageById } from "../coloring/catalog";
import type { KidsDocumentBackend, KidsDocumentSummary } from "../documents";
import type { RasterPipeline } from "../render/createRasterPipeline";
import {
  getLoadedRasterImage,
  registerRasterImage,
  warmRasterImage,
} from "../shapes/rasterImageCache";
import type { NewDocumentRequest } from "../view/DocumentBrowserOverlay";
import {
  DocumentSessionController,
  type DocumentSessionPresentation,
} from "./createDocumentSessionController";
import type { RenderLoopController } from "./createRenderLoopController";
import type { SnapshotService } from "./createSnapshotService";
import type { ToolbarStateController } from "./createToolbarStateController";
import { logStartupEvent } from "./startup/startupLogger";
import type { KidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";
import type { StartupReadinessStore } from "./stores/createStartupReadinessStore";

export const DEFAULT_THUMBNAIL_SAVE_DEBOUNCE_MS = 1000;
const STARTUP_ASSET_TIMEOUT_MS = 2500;

export interface DocumentRuntimeController {
  switchToDocument(docUrl: string): Promise<void>;
  createNewDocument(request: NewDocumentRequest): Promise<void>;
  flushThumbnailSave(): Promise<void>;
  scheduleThumbnailSave(delayMs?: number): void;
  start(): void;
  dispose(): void;
}

export function createDocumentRuntimeController(options: {
  store: DrawingStore;
  core: SmalldrawCore;
  documentBackend: KidsDocumentBackend;
  snapshotService: Pick<SnapshotService, "createThumbnailBlob">;
  runtimeStore: Pick<KidsDrawRuntimeStore, "setPresentation" | "isDestroyed">;
  startupReadinessStore: Pick<
    StartupReadinessStore,
    | "startDocLoad"
    | "setAssetsExpected"
    | "markAssetLoaded"
    | "markAssetFailed"
    | "startFirstBake"
    | "markReady"
    | "markDegraded"
  >;
  toolbarStateController: Pick<
    ToolbarStateController,
    "applyToolbarStateForCurrentDocument" | "getCurrentToolbarSignature"
  >;
  renderLoopController: Pick<
    RenderLoopController,
    "updateRenderIdentity" | "requestRenderFromModel"
  >;
  pipeline: Pick<
    RasterPipeline,
    "setLayers" | "scheduleBakeForClear" | "bakePendingTiles" | "flushBakes"
  >;
  syncToolbarUi: () => void;
  applyCanvasSize: (width: number, height: number) => void;
  getDocumentSizeFromViewport: () => DrawingDocumentSize;
  hasExplicitSize: boolean;
  getExplicitSize: () => DrawingDocumentSize;
  thumbnailSaveDebounceMs?: number;
}) {
  const thumbnailSaveDebounceMs =
    options.thumbnailSaveDebounceMs ?? DEFAULT_THUMBNAIL_SAVE_DEBOUNCE_MS;
  let startupCycleId = 0;
  const pendingImageLoads = new Map<string, Promise<boolean>>();
  const documentSessionController = new DocumentSessionController({
    store: options.store,
    core: options.core,
    documentBackend: options.documentBackend,
    thumbnailSaveDebounceMs,
    createThumbnailBlob: () => options.snapshotService.createThumbnailBlob(),
    getDocumentSizeForCreateRequest: (request) => {
      if (request.mode === "coloring") {
        const page = getColoringPageById(request.coloringPageId);
        if (page) {
          return page.size;
        }
      }
      return options.hasExplicitSize
        ? options.getExplicitSize()
        : options.getDocumentSizeFromViewport();
    },
  });

  const applyToolbarStateForCurrentDocument = (
    presentation: DocumentSessionPresentation,
    applyOptions?: {
      forceDefaults?: boolean;
    },
  ): void => {
    options.toolbarStateController.applyToolbarStateForCurrentDocument(
      presentation,
      applyOptions,
    );
  };

  const scheduleThumbnailSave = (delayMs = thumbnailSaveDebounceMs): void => {
    documentSessionController.scheduleThumbnailSave(delayMs);
  };

  const beginStartupCycle = (reason: string): number => {
    startupCycleId += 1;
    options.startupReadinessStore.startDocLoad(reason);
    logStartupEvent("document_load_start", {
      cycleId: startupCycleId,
      reason,
      docUrl: options.core.getCurrentDocUrl(),
    });
    return startupCycleId;
  };

  const loadReferenceImage = async (
    referenceImageSrc: string,
    cycleId: number,
  ): Promise<boolean> => {
    if (getLoadedRasterImage(referenceImageSrc)) {
      return true;
    }
    if (typeof Image !== "function") {
      return false;
    }
    const existing = pendingImageLoads.get(referenceImageSrc);
    if (existing) {
      return existing;
    }
    const promise = new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (loaded: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(loaded);
      };
      const timeoutHandle = setTimeout(() => {
        settle(false);
      }, STARTUP_ASSET_TIMEOUT_MS);
      const loader = new Image();
      loader.decoding = "async";
      loader.onload = () => {
        clearTimeout(timeoutHandle);
        registerRasterImage(referenceImageSrc, loader);
        if (!options.runtimeStore.isDestroyed() && cycleId === startupCycleId) {
          options.pipeline.scheduleBakeForClear();
          options.pipeline.bakePendingTiles();
          options.renderLoopController.requestRenderFromModel();
          scheduleThumbnailSave(0);
        }
        settle(true);
      };
      loader.onerror = () => {
        clearTimeout(timeoutHandle);
        settle(false);
      };
      loader.src = referenceImageSrc;
    }).finally(() => {
      pendingImageLoads.delete(referenceImageSrc);
    });
    pendingImageLoads.set(referenceImageSrc, promise);
    return promise;
  };

  const getLayerImageSources = (layers: DrawingLayer[]): string[] => {
    const seen = new Set<string>();
    const sources: string[] = [];
    for (const layer of layers) {
      if (layer.kind !== "image" || !layer.image?.src) {
        continue;
      }
      const src = layer.image.src;
      if (seen.has(src)) {
        continue;
      }
      seen.add(src);
      sources.push(src);
    }
    return sources;
  };

  const warmLayerImageLoads = async (
    layers: DrawingLayer[],
    cycleId: number,
  ): Promise<{ expected: number; failed: number }> => {
    const sources = getLayerImageSources(layers);
    options.startupReadinessStore.setAssetsExpected(sources.length);
    logStartupEvent("assets_expected", {
      cycleId,
      count: sources.length,
    });
    const results = await Promise.all(
      sources.map(async (src) => {
        warmRasterImage(src);
        const loaded = await loadReferenceImage(src, cycleId);
        if (loaded) {
          options.startupReadinessStore.markAssetLoaded();
          logStartupEvent("asset_loaded", { cycleId, src });
          return true;
        }
        options.startupReadinessStore.markAssetFailed();
        logStartupEvent("asset_failed", { cycleId, src }, "warn");
        return false;
      }),
    );
    let failed = 0;
    for (const loaded of results) {
      if (!loaded) {
        failed += 1;
      }
    }
    return { expected: sources.length, failed };
  };

  const applyDocumentPresentation = (
    presentation: DocumentSessionPresentation,
  ): void => {
    const cycleId = beginStartupCycle("apply_presentation");
    options.runtimeStore.setPresentation(presentation);
    const layers = getOrderedLayersFromDoc(options.store.getDocument());
    void (async () => {
      const { expected, failed } = await warmLayerImageLoads(layers, cycleId);
      if (options.runtimeStore.isDestroyed() || cycleId !== startupCycleId) {
        return;
      }
      options.startupReadinessStore.startFirstBake();
      logStartupEvent("first_bake_start", { cycleId });
      options.pipeline.setLayers(layers);
      logStartupEvent("layers_set", {
        cycleId,
        layerCount: layers.length,
      });
      options.renderLoopController.updateRenderIdentity();
      options.pipeline.scheduleBakeForClear();
      options.pipeline.bakePendingTiles();
      try {
        await options.pipeline.flushBakes();
        options.renderLoopController.requestRenderFromModel();
        if (failed > 0) {
          options.startupReadinessStore.markDegraded(
            "assets_failed_or_timed_out",
          );
          logStartupEvent(
            "document_load_end",
            { cycleId, status: "degraded", assetsFailed: failed, expected },
            "warn",
          );
        } else {
          options.startupReadinessStore.markReady();
          logStartupEvent("document_load_end", {
            cycleId,
            status: "ready",
            expected,
          });
        }
        logStartupEvent("interaction_enabled", {
          cycleId,
          status: failed > 0 ? "degraded" : "ready",
        });
      } catch (error) {
        options.startupReadinessStore.markDegraded("first_bake_failed");
        logStartupEvent(
          "first_bake_error",
          {
            cycleId,
            error: error instanceof Error ? error.message : String(error),
          },
          "error",
        );
      }
    })();
  };

  const toDocumentMetadataFromPresentation = (
    presentation: DocumentSessionPresentation,
  ): Pick<
    KidsDocumentSummary,
    "mode" | "coloringPageId" | "referenceImageSrc" | "referenceComposite"
  > =>
    documentSessionController.toDocumentMetadataFromPresentation(presentation);

  const unbindDocumentSessionIntents =
    documentSessionController.state.subscribeDrainedIntents((intents) => {
      for (const intent of intents) {
        if (intent.type === "apply_canvas_size") {
          options.applyCanvasSize(intent.width, intent.height);
          continue;
        }
        if (intent.type === "apply_presentation") {
          applyDocumentPresentation(intent.presentation);
          continue;
        }
        if (intent.type === "apply_toolbar_state") {
          applyToolbarStateForCurrentDocument(intent.presentation, {
            forceDefaults: intent.forceDefaults,
          });
          continue;
        }
        if (intent.type === "adapter_applied") {
          options.syncToolbarUi();
          continue;
        }
        if (intent.type === "switch_or_create_completed") {
          logStartupEvent("document_load_switch_complete", {
            docUrl: options.core.getCurrentDocUrl(),
          });
          options.pipeline.scheduleBakeForClear();
          options.pipeline.bakePendingTiles();
          options.renderLoopController.requestRenderFromModel();
        }
      }
    });

  const ensureCurrentDocumentMetadata = async (): Promise<{
    presentation: DocumentSessionPresentation;
    stillCurrent: boolean;
  }> => {
    const docUrl = options.core.getCurrentDocUrl();
    const presentation = documentSessionController.resolveDocumentPresentation(
      options.store.getDocument().presentation,
    );
    await options.documentBackend.createDocument({
      docUrl,
      ...toDocumentMetadataFromPresentation(presentation),
      documentSize: options.store.getDocument().size,
    });
    if (docUrl !== options.core.getCurrentDocUrl()) {
      return { presentation, stillCurrent: false };
    }
    applyDocumentPresentation(presentation);
    return { presentation, stillCurrent: true };
  };

  return {
    async switchToDocument(docUrl: string): Promise<void> {
      beginStartupCycle("switch_document");
      await documentSessionController.switchToDocument(docUrl);
    },
    async createNewDocument(request: NewDocumentRequest): Promise<void> {
      beginStartupCycle("create_document");
      await documentSessionController.createNewDocument(request);
    },
    async flushThumbnailSave(): Promise<void> {
      await documentSessionController.flushThumbnailSave();
    },
    scheduleThumbnailSave,
    start(): void {
      beginStartupCycle("app_start");
      applyDocumentPresentation({ mode: "normal" });
      applyToolbarStateForCurrentDocument({ mode: "normal" });
      const initialToolbarSignature =
        options.toolbarStateController.getCurrentToolbarSignature();
      void (async () => {
        const result = await ensureCurrentDocumentMetadata();
        if (!result.stillCurrent) {
          return;
        }
        const currentToolbarSignature =
          options.toolbarStateController.getCurrentToolbarSignature();
        if (currentToolbarSignature !== initialToolbarSignature) {
          return;
        }
        applyToolbarStateForCurrentDocument(result.presentation);
      })();

      documentSessionController.subscribeToCoreAdapter();
      documentSessionController.scheduleDocumentTouch();
    },
    dispose(): void {
      unbindDocumentSessionIntents();
      documentSessionController.dispose();
    },
  } satisfies DocumentRuntimeController;
}
