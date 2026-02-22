import {
  ClearCanvas,
  getTopZIndex,
  type DrawingStore,
} from "@smalldraw/core";
import type { IconNode } from "lucide";
import type { ToolbarUiStore } from "../ui/stores/toolbarUiStore";
import type { SnapshotService } from "./createSnapshotService";

type ConfirmDialogRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: IconNode;
};

type SaveFilePickerLike = (options: {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

export interface KidsDrawCommandController {
  undo(): void;
  redo(): void;
  clear(): void;
  exportAndClose(): void;
  newDrawingAndClose(): void;
  browseAndClose(): void;
  destroy(): void;
}

export function createKidsDrawCommandController(options: {
  store: Pick<DrawingStore, "undo" | "redo" | "applyAction" | "getDocument">;
  toolbarUiStore: Pick<ToolbarUiStore, "setMobileActionsOpen" | "setNewDrawingPending">;
  snapshotService: Pick<SnapshotService, "createPngExport">;
  getSize: () => { width: number; height: number };
  openDocumentPicker: () => Promise<void>;
  openDocumentCreateDialog: () => void;
  confirmDestructiveAction: (dialog: ConfirmDialogRequest) => Promise<boolean>;
  clearConfirmationIcon: IconNode;
  isDestroyed: () => boolean;
  debugLifecycle: (...args: unknown[]) => void;
}) {
  let newDrawingRequestId = 0;
  let clearCounter = 0;

  const closeMobilePortraitActions = (): void => {
    options.toolbarUiStore.setMobileActionsOpen(false);
  };

  const newDrawing = async (): Promise<void> => {
    const requestId = ++newDrawingRequestId;
    const destroyed = options.isDestroyed();
    options.debugLifecycle("new-drawing:start", { requestId, destroyed });
    if (destroyed || requestId !== newDrawingRequestId) {
      return;
    }
    options.toolbarUiStore.setNewDrawingPending(true);
    try {
      options.openDocumentCreateDialog();
    } finally {
      if (!options.isDestroyed() && requestId === newDrawingRequestId) {
        options.toolbarUiStore.setNewDrawingPending(false);
      }
    }
    options.debugLifecycle("new-drawing:chooser-open", {
      requestId,
      currentRequestId: newDrawingRequestId,
      destroyed: options.isDestroyed(),
    });
  };

  const exportDrawing = async (): Promise<void> => {
    const size = options.getSize();
    const exported = await options.snapshotService.createPngExport({
      width: size.width,
      height: size.height,
    });
    if (!exported.blob && !exported.dataUrl) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `kids-draw-${timestamp}.png`;
    const blob = exported.blob;
    const picker = (
      window as unknown as {
        showSaveFilePicker?: SaveFilePickerLike;
      }
    ).showSaveFilePicker;

    if (blob && picker) {
      try {
        const fileHandle = await picker({
          suggestedName: fileName,
          types: [
            {
              description: "PNG Image",
              accept: { "image/png": [".png"] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    if (blob) {
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = fileName;
      link.rel = "noopener";
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      return;
    }

    if (!exported.dataUrl) {
      return;
    }
    const link = document.createElement("a");
    link.href = exported.dataUrl;
    link.download = fileName;
    link.rel = "noopener";
    link.click();
  };

  return {
    undo(): void {
      options.store.undo();
      closeMobilePortraitActions();
    },
    redo(): void {
      options.store.redo();
      closeMobilePortraitActions();
    },
    clear(): void {
      void (async () => {
        const confirmed = await options.confirmDestructiveAction({
          title: "Clear drawing?",
          message: "This removes all strokes from the current drawing.",
          confirmLabel: "Clear",
          cancelLabel: "Keep Drawing",
          tone: "danger",
          icon: options.clearConfirmationIcon,
        });
        if (!confirmed || options.isDestroyed()) {
          return;
        }

        const clearShapeId = `clear-${Date.now()}-${clearCounter++}`;
        options.store.applyAction(
          new ClearCanvas({
            id: clearShapeId,
            type: "clear",
            zIndex: getTopZIndex(options.store.getDocument()),
            geometry: { type: "clear" },
            style: {},
          }),
        );
        closeMobilePortraitActions();
      })();
    },
    exportAndClose(): void {
      void exportDrawing();
      closeMobilePortraitActions();
    },
    newDrawingAndClose(): void {
      void newDrawing();
      closeMobilePortraitActions();
    },
    browseAndClose(): void {
      void options.openDocumentPicker();
      closeMobilePortraitActions();
    },
    destroy(): void {
      newDrawingRequestId += 1;
    },
  } satisfies KidsDrawCommandController;
}
