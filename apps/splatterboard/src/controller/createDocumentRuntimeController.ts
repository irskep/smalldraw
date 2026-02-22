import type {
  DrawingDocumentSize,
  DrawingStore,
  SmalldrawCore,
} from "@smalldraw/core";
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
import type { KidsDrawRuntimeStore } from "./stores/createKidsDrawRuntimeStore";

export const DEFAULT_THUMBNAIL_SAVE_DEBOUNCE_MS = 1000;

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
    "setReferenceOverlaySource" | "scheduleBakeForClear" | "bakePendingTiles"
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
  let coloringOverlayLoadRequestId = 0;
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

  const getReferenceOverlaySrc = (
    presentation: DocumentSessionPresentation,
  ): string | null =>
    documentSessionController.getReferenceOverlaySrc(presentation);

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

  const queueColoringOverlayRebakeWhenLoaded = (
    overlaySrc: string | null,
  ): void => {
    coloringOverlayLoadRequestId += 1;
    if (!overlaySrc || typeof Image !== "function") {
      return;
    }
    const requestId = coloringOverlayLoadRequestId;
    if (getLoadedRasterImage(overlaySrc)) {
      return;
    }
    const loader = new Image();
    loader.decoding = "async";
    loader.onload = () => {
      if (
        options.runtimeStore.isDestroyed() ||
        requestId !== coloringOverlayLoadRequestId
      ) {
        return;
      }
      registerRasterImage(overlaySrc, loader);
      options.renderLoopController.requestRenderFromModel();
      scheduleThumbnailSave(0);
    };
    loader.src = overlaySrc;
  };

  const applyDocumentPresentation = (
    presentation: DocumentSessionPresentation,
  ): void => {
    options.runtimeStore.setPresentation(presentation);
    const overlaySrc = getReferenceOverlaySrc(presentation);
    options.pipeline.setReferenceOverlaySource(overlaySrc);
    options.renderLoopController.updateRenderIdentity();
    if (overlaySrc) {
      warmRasterImage(overlaySrc);
    }
    queueColoringOverlayRebakeWhenLoaded(overlaySrc);
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
      await documentSessionController.switchToDocument(docUrl);
    },
    async createNewDocument(request: NewDocumentRequest): Promise<void> {
      await documentSessionController.createNewDocument(request);
    },
    async flushThumbnailSave(): Promise<void> {
      await documentSessionController.flushThumbnailSave();
    },
    scheduleThumbnailSave,
    start(): void {
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
