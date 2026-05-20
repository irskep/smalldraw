import type { KidsDocumentSummary } from "../documents";
import type { NewDocumentRequest } from "../documents/newDocumentRequest";
import {
  isDocumentAccessError,
} from "../app/documentBootstrap";

type DocumentPickerControllerLike = {
  isOpen(): boolean;
  isCreateDialogOpen(): boolean;
  getDocuments(): KidsDocumentSummary[];
  getUnavailableDocumentMessage(docUrl: string): string | null;
  setBusyDocument(docUrl: string | null): void;
  setClaimableDocuments(docUrls: Iterable<string>): void;
  setUnavailableDocumentMessage(docUrl: string, message: string | null): void;
  setRemovingDocument(docUrl: string | null): void;
  waitForRemovingDocument(docUrl: string): Promise<void>;
  removeDocument(docUrl: string): void;
  close(): void;
  closeCreateDialog(): void;
  open(): Promise<KidsDocumentSummary[]>;
  reload(): Promise<KidsDocumentSummary[]>;
};

export function createDocumentBrowserCommands(options: {
  documentPickerController: DocumentPickerControllerLike;
  getCurrentDocUrl: () => string;
  switchToDocument: (docUrl: string) => Promise<void>;
  createNewDocument: (request: NewDocumentRequest) => Promise<void>;
  flushThumbnailSave: () => Promise<void>;
  listDocuments: () => Promise<KidsDocumentSummary[]>;
  claimDocument: (document: KidsDocumentSummary) => Promise<void>;
  isClaimableDocument: (document: KidsDocumentSummary) => boolean;
  describeClaimability?: (document: KidsDocumentSummary) => unknown;
  deleteDocument: (docUrl: string) => Promise<void>;
  confirmDelete: () => Promise<boolean>;
  onClaimError?: (message: string) => void;
  onOpenDocumentError?: (message: string) => void;
  isDestroyed: () => boolean;
}) {
  const isUnavailableDocumentError = (error: unknown): boolean => {
    return (
      error instanceof Error &&
      /document .* is unavailable/i.test(error.message)
    );
  };

  const toCollaborativeUnavailableMessage = (
    document: KidsDocumentSummary,
  ): string => {
    return `${document.title?.trim() || "This drawing"} is no longer syncing.\n\nThis browser still has its local record and preview, but the shared copy can't be opened anymore. You can keep it here for reference or delete it from Browse Drawings.`;
  };

  const toOpenDocumentErrorMessage = (error: unknown): string => {
    if (isDocumentAccessError(error)) {
      return error.userMessage;
    }
    if (isUnavailableDocumentError(error)) {
      return "This drawing is no longer stored in this browser.";
    }
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return "Failed to open this drawing.";
  };

  const updateClaimableDocuments = (
    documents: readonly KidsDocumentSummary[],
  ): KidsDocumentSummary[] => {
    const nextDocuments = [...documents];
    const claimableDocUrls = nextDocuments
      .filter((document) => options.isClaimableDocument(document))
      .map((document) => document.docUrl);
    console.info("[kids-draw:documents] picker claimability recompute", {
      documents: nextDocuments.map((document) => ({
        docUrl: document.docUrl,
        collaborative: document.collaborative ?? false,
        collabDocUrl: document.collabDocUrl ?? null,
        accessToken: document.accessToken ? "<present>" : null,
        accessTokenScope: document.accessTokenScope ?? null,
        accountAttached: document.accountAttached ?? false,
        claim: options.describeClaimability?.(document) ?? null,
      })),
      claimableDocUrls,
    });
    options.documentPickerController.setClaimableDocuments(claimableDocUrls);
    return nextDocuments;
  };

  const closeDocumentPicker = (): void => {
    options.documentPickerController.close();
  };

  const reloadDocumentPicker = async (): Promise<void> => {
    console.info("[kids-draw:documents] picker reload start");
    options.documentPickerController.setClaimableDocuments([]);
    const documents = await options.documentPickerController.reload();
    updateClaimableDocuments(documents);
  };

  const openDocumentPicker = async (): Promise<void> => {
    await options.flushThumbnailSave();
    console.info("[kids-draw:documents] picker open start");
    options.documentPickerController.setClaimableDocuments([]);
    const documents = await options.documentPickerController.open();
    updateClaimableDocuments(documents);
  };

  const createNewDocumentFromBrowser = async (
    request: NewDocumentRequest,
  ): Promise<void> => {
    if (
      !options.documentPickerController.isOpen() &&
      !options.documentPickerController.isCreateDialogOpen()
    ) {
      return;
    }
    options.documentPickerController.setBusyDocument("__new__");
    try {
      await options.createNewDocument(request);
      closeDocumentPicker();
      options.documentPickerController.closeCreateDialog();
    } finally {
      options.documentPickerController.setBusyDocument(null);
    }
  };

  const openDocumentFromBrowser = async (docUrl: string): Promise<void> => {
    if (!options.documentPickerController.isOpen()) {
      return;
    }
    if (docUrl === options.getCurrentDocUrl()) {
      closeDocumentPicker();
      return;
    }
    const existingUnavailableMessage =
      options.documentPickerController.getUnavailableDocumentMessage(docUrl);
    if (existingUnavailableMessage) {
      options.onOpenDocumentError?.(existingUnavailableMessage);
      return;
    }
    options.documentPickerController.setBusyDocument(docUrl);
    try {
      await options.switchToDocument(docUrl);
      options.documentPickerController.setUnavailableDocumentMessage(
        docUrl,
        null,
      );
      closeDocumentPicker();
    } catch (error) {
      const document = options.documentPickerController
        .getDocuments()
        .find((item) => item.docUrl === docUrl);
      if (
        document?.collaborative &&
        document.collabDocUrl &&
        isUnavailableDocumentError(error)
      ) {
        const message = toCollaborativeUnavailableMessage(document);
        options.documentPickerController.setUnavailableDocumentMessage(
          docUrl,
          message,
        );
        console.warn("[kids-draw:documents] collaborative open unavailable", {
          docUrl,
          collabDocUrl: document.collabDocUrl,
          message,
          error,
        });
        options.onOpenDocumentError?.(message);
        return;
      }
      const message = toOpenDocumentErrorMessage(error);
      console.warn("[kids-draw:documents] open failed", {
        docUrl,
        message,
        error,
      });
      options.onOpenDocumentError?.(message);
    } finally {
      options.documentPickerController.setBusyDocument(null);
    }
  };

  const deleteDocumentFromBrowser = async (docUrl: string): Promise<void> => {
    if (!options.documentPickerController.isOpen()) {
      return;
    }
    const confirmed = await options.confirmDelete();
    if (!confirmed || options.isDestroyed()) {
      return;
    }
    options.documentPickerController.setBusyDocument(docUrl);
    try {
      const deletingCurrent = docUrl === options.getCurrentDocUrl();
      if (!deletingCurrent) {
        options.documentPickerController.setRemovingDocument(docUrl);
        await options.documentPickerController.waitForRemovingDocument(docUrl);
        options.documentPickerController.removeDocument(docUrl);
      }
      if (deletingCurrent) {
        await options.flushThumbnailSave();
      }
      await options.deleteDocument(docUrl);
      if (deletingCurrent) {
        const remainingDocs = await options.listDocuments();
        const fallback = remainingDocs[0];
        if (fallback) {
          await options.switchToDocument(fallback.docUrl);
        } else {
          await options.createNewDocument({ mode: "normal" });
        }
      }
      await reloadDocumentPicker();
    } catch (error) {
      await reloadDocumentPicker();
      throw error;
    } finally {
      options.documentPickerController.setRemovingDocument(null);
      options.documentPickerController.setBusyDocument(null);
    }
  };

  const claimDocumentFromBrowser = async (docUrl: string): Promise<void> => {
    if (!options.documentPickerController.isOpen()) {
      return;
    }
    options.documentPickerController.setBusyDocument(docUrl);
    try {
      const document = options.documentPickerController
        .getDocuments()
        .find((item) => item.docUrl === docUrl);
      if (!document) {
        throw new Error("This drawing is no longer available.");
      }
      await options.claimDocument(document);
      await reloadDocumentPicker();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Failed to claim this drawing.";
      console.warn("[kids-draw:documents] claim failed", {
        docUrl,
        message,
        error,
      });
      options.onClaimError?.(message);
    } finally {
      options.documentPickerController.setBusyDocument(null);
    }
  };

  return {
    closeDocumentPicker,
    reloadDocumentPicker,
    openDocumentPicker,
    createNewDocumentFromBrowser,
    openDocumentFromBrowser,
    claimDocumentFromBrowser,
    deleteDocumentFromBrowser,
  };
}
