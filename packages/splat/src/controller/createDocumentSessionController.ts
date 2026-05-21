import type {
  DrawingDocumentPresentation,
  DrawingDocumentSize,
  DrawingStore,
  SmalldrawCore,
} from "@smalldraw/core";
import {
  extractColoringPageId,
  getColoringPageById,
} from "../coloring/catalog";
import type {
  KidsDocumentBackend,
  KidsDocumentMode,
  KidsDocumentSummary,
} from "../documents";
import { resolveDocumentOpenUrl } from "../documents";
import type { NewDocumentRequest } from "../documents/newDocumentRequest";
import {
  createDocumentSessionStore,
  type DocumentSessionIntent,
} from "./stores/createDocumentSessionStore";

export interface DocumentSessionPresentation {
  mode: KidsDocumentMode;
  coloringPageId?: string;
  referenceImageSrc?: string;
  referenceComposite?: "under-drawing" | "over-drawing";
}

export class DocumentSessionController {
  private unsubscribeCoreAdapter: (() => void) | null = null;
  private metadataTouchTimeoutHandle: ReturnType<typeof setTimeout> | null =
    null;
  private thumbnailSaveTimeoutHandle: ReturnType<typeof setTimeout> | null =
    null;
  private currentCatalogDocUrl: string;
  readonly state = createDocumentSessionStore();

  constructor(
    private readonly options: {
      store: DrawingStore;
      core: SmalldrawCore;
      documentBackend: KidsDocumentBackend;
      initialCatalogDocUrl?: string;
      beforeOpenDocument?: (
        summary: KidsDocumentSummary | null,
      ) => Promise<void> | void;
      thumbnailSaveDebounceMs: number;
      createThumbnailBlob: () => Promise<Blob | null>;
      onThumbnailSaved?: (docUrl: string, blob: Blob) => Promise<void> | void;
      getDocumentSizeForCreateRequest: (
        request: NewDocumentRequest,
      ) => DrawingDocumentSize;
    },
  ) {
    this.currentCatalogDocUrl =
      this.options.initialCatalogDocUrl ?? this.options.core.getCurrentDocUrl();
  }

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
      const coloringPageId = extractColoringPageId(referenceImage.src);
      const coloringPage = coloringPageId
        ? getColoringPageById(coloringPageId)
        : null;
      const mode: KidsDocumentMode =
        explicitDocumentType ??
        (referenceImage.composite === "under-drawing" ? "markup" : "coloring");
      if (!coloringPage) {
        return explicitDocumentType ? { mode: explicitDocumentType } : { mode };
      }
      return {
        mode,
        coloringPageId: coloringPage.id,
        referenceImageSrc: coloringPage.id,
        referenceComposite: referenceImage.composite,
      };
    }
    if (explicitDocumentType) {
      return { mode: explicitDocumentType };
    }
    return { mode: "normal" };
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
        src: page.id,
        composite: "over-drawing",
      },
    };
  }

  subscribeToCoreAdapter(): void {
    this.unsubscribeCoreAdapter?.();
    this.unsubscribeCoreAdapter = this.options.core.storeAdapter.subscribe(
      (doc) => {
        this.options.store.applyDocument(doc);
        this.scheduleDocumentTouch();
        this.scheduleThumbnailSave();
        this.emitIntent({ type: "adapter_applied" });
      },
    );
  }

  async switchToDocument(docUrl: string): Promise<void> {
    const persistedSummary =
      await this.options.documentBackend.getDocument(docUrl);
    if (!persistedSummary && docUrl.startsWith("catalog-collab:")) {
      throw new Error(
        "The drawing could not be opened right now. Please try again.",
      );
    }
    const openDocUrl = resolveDocumentOpenUrl(docUrl, persistedSummary);
    await this.flushThumbnailSave();
    await this.options.beforeOpenDocument?.(persistedSummary);
    const adapter = await this.options.core.open(openDocUrl);
    this.currentCatalogDocUrl = docUrl;
    const openedDocument = adapter.getDoc();
    const docSize = openedDocument.size;
    const resolvedPresentation = this.resolveDocumentPresentation(
      openedDocument.presentation,
    );
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
    const nextDocumentSize =
      this.options.getDocumentSizeForCreateRequest(request);
    await this.flushThumbnailSave();
    const { adapter, url } = await this.options.core.createNew({
      documentSize: nextDocumentSize,
      documentPresentation: requestPresentation,
    });
    this.currentCatalogDocUrl = url;
    const createdDocument = adapter.getDoc();
    const presentation = this.resolveDocumentPresentation(
      createdDocument.presentation,
    );
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
    const docUrl = this.currentCatalogDocUrl;
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
    const docUrl = this.currentCatalogDocUrl;
    try {
      const thumbnailBlob = await this.options.createThumbnailBlob();
      if (!thumbnailBlob) {
        return;
      }
      await this.options.documentBackend.saveThumbnail(docUrl, thumbnailBlob);
      void this.options.onThumbnailSaved?.(docUrl, thumbnailBlob);
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

  getCurrentCatalogDocUrl(): string {
    return this.currentCatalogDocUrl;
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
    const coloringPageId =
      persistedSummary.coloringPageId ??
      (persistedSummary.referenceImageSrc
        ? extractColoringPageId(persistedSummary.referenceImageSrc)
        : null) ??
      resolvedPresentation.coloringPageId;
    const catalogPage = coloringPageId
      ? getColoringPageById(coloringPageId)
      : null;
    if (resolvedPresentation.mode === persistedSummary.mode) {
      if (catalogPage) {
        return {
          ...resolvedPresentation,
          coloringPageId: catalogPage.id,
          referenceImageSrc: catalogPage.id,
        };
      }
      return resolvedPresentation;
    }
    if (catalogPage && persistedSummary.referenceComposite) {
      return {
        mode: persistedSummary.mode,
        coloringPageId: catalogPage.id,
        referenceImageSrc: catalogPage.id,
        referenceComposite: persistedSummary.referenceComposite,
      };
    }
    return resolvedPresentation;
  }

  private emitIntent(intent: DocumentSessionIntent): void {
    this.state.emitIntent(intent);
  }
}
