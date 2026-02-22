import type { KidsDocumentSummary } from "../documents";
import type { NewDocumentRequest } from "../view/DocumentBrowserOverlay";

type DocumentPickerControllerLike = {
  isOpen(): boolean;
  isCreateDialogOpen(): boolean;
  setBusyDocument(docUrl: string | null): void;
  close(): void;
  closeCreateDialog(): void;
  open(): Promise<void>;
  reload(): Promise<void>;
};

export function createDocumentBrowserCommands(options: {
  documentPickerController: DocumentPickerControllerLike;
  getCurrentDocUrl: () => string;
  switchToDocument: (docUrl: string) => Promise<void>;
  createNewDocument: (request: NewDocumentRequest) => Promise<void>;
  flushThumbnailSave: () => Promise<void>;
  listDocuments: () => Promise<KidsDocumentSummary[]>;
  deleteDocument: (docUrl: string) => Promise<void>;
  confirmDelete: () => Promise<boolean>;
  isDestroyed: () => boolean;
}) {
  const closeDocumentPicker = (): void => {
    options.documentPickerController.close();
  };

  const reloadDocumentPicker = async (): Promise<void> => {
    await options.documentPickerController.reload();
  };

  const openDocumentPicker = async (): Promise<void> => {
    await options.documentPickerController.open();
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
    options.documentPickerController.setBusyDocument(docUrl);
    try {
      await options.switchToDocument(docUrl);
      closeDocumentPicker();
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
    deleteDocumentFromBrowser,
  };
}
