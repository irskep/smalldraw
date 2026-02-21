import type {
  DrawingDocumentPresentation,
  DrawingDocumentSize,
  DrawingStore,
  SmalldrawCore,
} from "@smalldraw/core";
import { getColoringPageById, getColoringPageBySrc } from "../coloring/catalog";
import type {
  KidsDocumentBackend,
  KidsDocumentMode,
  KidsDocumentSummary,
} from "../documents";
import {
  createDocumentSessionStore,
  type DocumentSessionIntent,
} from "./stores/createDocumentSessionStore";
import type { NewDocumentRequest } from "../view/DocumentBrowserOverlay";

export interface DocumentSessionPresentation {
  mode: KidsDocumentMode;
  coloringPageId?: string;
  referenceImageSrc?: string;
  referenceComposite?: "under-drawing" | "over-drawing";
}

export class DocumentSessionController {
  private unsubscribeCoreAdapter: (() => void) | null = null;
  private metadataTouchTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private thumbnailSaveTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  readonly state = createDocumentSessionStore();

  constructor(
    private readonly options: {
      store: DrawingStore;
      core: SmalldrawCore;
      documentBackend: KidsDocumentBackend;
      thumbnailSaveDebounceMs: number;
      createThumbnailBlob: () => Promise<Blob | null>;
      getDocumentSizeForCreateRequest: (request: NewDocumentRequest) => DrawingDocumentSize;
    },
  ) {}

  resolveDocumentPresentation(
    documentPresentation: DrawingDocumentPresentation | undefined,
  ): DocumentSessionPresentation {
    const explicitDocumentType =
      documentPresentation?.documentType === "normal" ||
      documentPresentation?.documentType === "coloring" ||
      documentPresentation?.documentType === "markup"
        ? documentPresentation.documentType
        : null;
    const referenceImage = documentPresentation?.referenceImage;
    if (
      referenceImage &&
      typeof referenceImage.src === "string" &&
      referenceImage.src.length > 0 &&
      (referenceImage.composite === "under-drawing" ||
        referenceImage.composite === "over-drawing")
    ) {
      const coloringPage = getColoringPageBySrc(referenceImage.src);
      const mode: KidsDocumentMode =
        explicitDocumentType ??
        (referenceImage.composite === "under-drawing" ? "markup" : "coloring");
      return {
        mode,
        coloringPageId: coloringPage?.id,
        referenceImageSrc: referenceImage.src,
        referenceComposite: referenceImage.composite,
      };
    }
    if (explicitDocumentType) {
      return { mode: explicitDocumentType };
    }
    return { mode: "normal" };
  }

  getReferenceOverlaySrc(
    presentation: DocumentSessionPresentation,
  ): string | null {
    if (
      presentation.referenceComposite !== "over-drawing" ||
      !presentation.referenceImageSrc
    ) {
      return null;
    }
    return presentation.referenceImageSrc;
  }

  toDocumentMetadataFromPresentation(
    presentation: DocumentSessionPresentation,
  ): Pick<
    KidsDocumentSummary,
    "mode" | "coloringPageId" | "referenceImageSrc" | "referenceComposite"
  > {
    if (presentation.mode === "normal") {
      return { mode: "normal" };
    }
    return {
      mode: presentation.mode,
      coloringPageId: presentation.coloringPageId,
      referenceImageSrc: presentation.referenceImageSrc,
      referenceComposite: presentation.referenceComposite,
    };
  }

  getPresentationForCreateRequest(
    request: NewDocumentRequest,
  ): DrawingDocumentPresentation {
    if (request.mode === "normal") {
      return { documentType: "normal" };
    }
    const page = getColoringPageById(request.coloringPageId);
    if (!page) {
      return { documentType: "normal" };
    }
    return {
      documentType: "coloring",
      referenceImage: {
        src: page.src,
        composite: "over-drawing",
      },
    };
  }

  subscribeToCoreAdapter(): void {
    this.unsubscribeCoreAdapter?.();
    this.unsubscribeCoreAdapter = this.options.core.storeAdapter.subscribe((doc) => {
      this.options.store.applyDocument(doc);
      this.scheduleDocumentTouch();
      this.scheduleThumbnailSave();
      this.emitIntent({ type: "adapter_applied" });
    });
  }

  async switchToDocument(docUrl: string): Promise<void> {
    await this.flushThumbnailSave();
    const adapter = await this.options.core.open(docUrl);
    const openedDocument = adapter.getDoc();
    const docSize = openedDocument.size;
    const resolvedPresentation = this.resolveDocumentPresentation(
      openedDocument.presentation,
    );
    const persistedSummary = await this.options.documentBackend.getDocument(docUrl);
    const presentation = this.resolvePresentationFromMetadata(
      resolvedPresentation,
      persistedSummary,
    );
    await this.options.documentBackend.createDocument({
      docUrl,
      ...this.toDocumentMetadataFromPresentation(presentation),
      documentSize: docSize,
    });
    await this.options.documentBackend.touchDocument(docUrl);
    this.options.store.resetToDocument(openedDocument);
    this.state.setCanvasSize(docSize);
    this.emitIntent({
      type: "apply_canvas_size",
      width: docSize.width,
      height: docSize.height,
    });
    this.state.setPresentation(presentation);
    this.emitIntent({
      type: "apply_presentation",
      presentation,
    });
    this.emitIntent({
      type: "apply_toolbar_state",
      presentation,
      forceDefaults: false,
    });
    this.subscribeToCoreAdapter();
    this.emitIntent({ type: "switch_or_create_completed" });
  }

  async createNewDocument(request: NewDocumentRequest): Promise<void> {
    const requestPresentation = this.getPresentationForCreateRequest(request);
    const nextDocumentSize = this.options.getDocumentSizeForCreateRequest(request);
    await this.flushThumbnailSave();
    const { adapter, url } = await this.options.core.createNew({
      documentSize: nextDocumentSize,
      documentPresentation: requestPresentation,
    });
    const createdDocument = adapter.getDoc();
    const presentation = this.resolveDocumentPresentation(createdDocument.presentation);
    await this.options.documentBackend.createDocument({
      docUrl: url,
      ...this.toDocumentMetadataFromPresentation(presentation),
      documentSize: nextDocumentSize,
    });
    this.options.store.resetToDocument(createdDocument);
    this.state.setCanvasSize(nextDocumentSize);
    this.emitIntent({
      type: "apply_canvas_size",
      width: nextDocumentSize.width,
      height: nextDocumentSize.height,
    });
    this.state.setPresentation(presentation);
    this.emitIntent({
      type: "apply_presentation",
      presentation,
    });
    this.emitIntent({
      type: "apply_toolbar_state",
      presentation,
      forceDefaults: true,
    });
    this.subscribeToCoreAdapter();
    this.emitIntent({ type: "switch_or_create_completed" });
  }

  async flushDocumentTouch(): Promise<void> {
    const docUrl = this.options.core.getCurrentDocUrl();
    try {
      await this.options.documentBackend.touchDocument(docUrl);
    } catch (error) {
      console.warn("[kids-draw:documents] failed to touch document", {
        docUrl,
        error,
      });
    }
  }

  async flushThumbnailSave(): Promise<void> {
    const docUrl = this.options.core.getCurrentDocUrl();
    try {
      const thumbnailBlob = await this.options.createThumbnailBlob();
      if (!thumbnailBlob) {
        return;
      }
      await this.options.documentBackend.saveThumbnail(docUrl, thumbnailBlob);
    } catch (error) {
      console.warn("[kids-draw:documents] failed to save thumbnail", {
        docUrl,
        error,
      });
    }
  }

  scheduleDocumentTouch(): void {
    if (this.metadataTouchTimeoutHandle !== null) {
      clearTimeout(this.metadataTouchTimeoutHandle);
    }
    this.metadataTouchTimeoutHandle = setTimeout(() => {
      this.metadataTouchTimeoutHandle = null;
      void this.flushDocumentTouch();
    }, 500);
  }

  scheduleThumbnailSave(delayMs = this.options.thumbnailSaveDebounceMs): void {
    if (this.thumbnailSaveTimeoutHandle !== null) {
      clearTimeout(this.thumbnailSaveTimeoutHandle);
    }
    this.thumbnailSaveTimeoutHandle = setTimeout(() => {
      this.thumbnailSaveTimeoutHandle = null;
      void this.flushThumbnailSave();
    }, delayMs);
  }

  dispose(): void {
    this.unsubscribeCoreAdapter?.();
    this.unsubscribeCoreAdapter = null;
    if (this.metadataTouchTimeoutHandle !== null) {
      clearTimeout(this.metadataTouchTimeoutHandle);
      this.metadataTouchTimeoutHandle = null;
    }
    if (this.thumbnailSaveTimeoutHandle !== null) {
      clearTimeout(this.thumbnailSaveTimeoutHandle);
      this.thumbnailSaveTimeoutHandle = null;
    }
  }

  private resolvePresentationFromMetadata(
    resolvedPresentation: DocumentSessionPresentation,
    persistedSummary: KidsDocumentSummary | null,
  ): DocumentSessionPresentation {
    if (!persistedSummary) {
      return resolvedPresentation;
    }
    if (persistedSummary.mode === "normal") {
      return { mode: "normal" };
    }
    if (
      resolvedPresentation.mode === persistedSummary.mode
    ) {
      return resolvedPresentation;
    }
    if (
      persistedSummary.referenceImageSrc &&
      (persistedSummary.referenceComposite === "under-drawing" ||
        persistedSummary.referenceComposite === "over-drawing")
    ) {
      return {
        mode: persistedSummary.mode,
        coloringPageId: persistedSummary.coloringPageId,
        referenceImageSrc: persistedSummary.referenceImageSrc,
        referenceComposite: persistedSummary.referenceComposite,
      };
    }
    return resolvedPresentation;
  }

  private emitIntent(intent: DocumentSessionIntent): void {
    this.state.emitIntent(intent);
  }
}
