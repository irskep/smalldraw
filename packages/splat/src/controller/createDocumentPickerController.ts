import type { KidsDocumentBackend, KidsDocumentSummary } from "../documents";
import { bindAtom } from "../view/atomBindings";
import type { DocumentBrowserOverlay } from "../view/DocumentBrowserOverlay";
import { createDocumentPickerStore } from "./stores/createDocumentPickerStore";

export class DocumentPickerController {
  private browserRequestId = 0;
  private unsubscribeStore: (() => void) | null = null;
  private readonly state = createDocumentPickerStore();

  constructor(
    private readonly options: {
      pickerOverlay: DocumentBrowserOverlay;
      documentBackend: KidsDocumentBackend;
      getCurrentDocUrl: () => string;
    },
  ) {
    this.unsubscribeStore = bindAtom(this.state.$state, (state) => {
      const { pickerOverlay, getCurrentDocUrl } = this.options;
      pickerOverlay.setLoading(state.loading);
      pickerOverlay.setBusyDocument(state.busyDocUrl);
      pickerOverlay.setDocuments(
        state.documents,
        getCurrentDocUrl(),
        state.thumbnailUrlByDocUrl,
        state.claimableDocUrls,
      );
    });
  }

  isOpen(): boolean {
    return this.options.pickerOverlay.isOpen();
  }

  isCreateDialogOpen(): boolean {
    return this.options.pickerOverlay.isCreateDialogOpen();
  }

  openCreateDialog(): void {
    this.options.pickerOverlay.openCreateDialog();
  }

  closeCreateDialog(): void {
    this.options.pickerOverlay.closeCreateDialog();
  }

  setBusyDocument(docUrl: string | null): void {
    this.state.setBusyDocument(docUrl);
  }

  setClaimableDocuments(docUrls: Iterable<string>): void {
    this.state.setClaimableDocUrls(new Set(docUrls));
  }

  close(): void {
    this.options.pickerOverlay.setOpen(false);
    this.state.setBusyDocument(null);
  }

  getDocuments(): KidsDocumentSummary[] {
    return this.state.get().documents;
  }

  async open(): Promise<KidsDocumentSummary[]> {
    this.options.pickerOverlay.setOpen(true);
    this.state.setBusyDocument(null);
    return await this.reload();
  }

  async reload(): Promise<KidsDocumentSummary[]> {
    const requestId = ++this.browserRequestId;
    this.state.setLoading(true);
    try {
      const documents = await this.options.documentBackend.listDocuments();
      if (requestId !== this.browserRequestId) {
        return this.state.get().documents;
      }
      this.state.setDocuments(documents);
      await this.loadThumbnails(requestId, documents);
      return documents;
    } finally {
      if (requestId === this.browserRequestId) {
        this.state.setLoading(false);
      }
    }
  }

  clearThumbnails(): void {
    const thumbnailUrlByDocUrl = this.state.get().thumbnailUrlByDocUrl;
    for (const url of thumbnailUrlByDocUrl.values()) {
      URL.revokeObjectURL(url);
    }
    this.state.clearThumbnailUrls();
  }

  dispose(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.clearThumbnails();
  }

  private async loadThumbnails(
    requestId: number,
    documents: KidsDocumentSummary[],
  ): Promise<void> {
    const nextThumbnailUrlByDocUrl = new Map<string, string>();
    for (const document of documents) {
      try {
        const thumbnailBlob = await this.options.documentBackend.getThumbnail(
          document.docUrl,
        );
        if (!thumbnailBlob) {
          continue;
        }
        nextThumbnailUrlByDocUrl.set(
          document.docUrl,
          URL.createObjectURL(thumbnailBlob),
        );
      } catch (error) {
        console.warn("[kids-draw:documents] failed to load thumbnail", {
          docUrl: document.docUrl,
          error,
        });
      }
    }
    if (requestId !== this.browserRequestId) {
      for (const url of nextThumbnailUrlByDocUrl.values()) {
        URL.revokeObjectURL(url);
      }
      return;
    }

    this.clearThumbnails();
    this.state.setThumbnailUrls(nextThumbnailUrlByDocUrl);
  }
}
