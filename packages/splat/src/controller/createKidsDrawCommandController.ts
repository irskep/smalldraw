import { ClearCanvas, type DrawingStore, getTopZIndex } from "@smalldraw/core";
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
  shareAndClose(): void;
  destroy(): void;
}

export type LoadedDocumentCommandScope = {
  run(command: () => void | Promise<void>): void;
};

export function createKidsDrawCommandController(options: {
  store: Pick<DrawingStore, "undo" | "redo" | "applyAction" | "getDocument">;
  toolbarUiStore: Pick<
    ToolbarUiStore,
    "setNewDrawingPending" | "setSharePending"
  >;
  snapshotService: Pick<SnapshotService, "createPngExport">;
  getSize: () => { width: number; height: number };
  openDocumentPicker: () => Promise<void>;
  openDocumentCreateDialog: () => void;
  shareCurrentDocument: () => Promise<void>;
  isSharingAllowed?: () => boolean;
  requestSharePermission?: () => Promise<boolean>;
  onShareError?: (message: string) => void;
  confirmDestructiveAction: (dialog: ConfirmDialogRequest) => Promise<boolean>;
  savePngExport?: (input: {
    suggestedName: string;
    blob?: Blob;
    dataUrl?: string;
  }) => Promise<boolean>;
  clearConfirmationIcon: IconNode;
  loadedDocumentCommands: LoadedDocumentCommandScope;
  isDestroyed: () => boolean;
  debugLifecycle: (...args: unknown[]) => void;
}) {
  let newDrawingRequestId = 0;
  let shareRequestId = 0;
  let clearCounter = 0;

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

    if (options.savePngExport) {
      try {
        const saved = await options.savePngExport({
          suggestedName: fileName,
          blob: exported.blob ?? undefined,
          dataUrl: exported.dataUrl ?? undefined,
        });
        if (saved) {
          return;
        }
      } catch {
        return;
      }
    }

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

  const shareCurrentDocument = async (): Promise<void> => {
    const requestId = ++shareRequestId;
    const startedAt = Date.now();
    if (options.isDestroyed() || requestId !== shareRequestId) {
      return;
    }
    console.info("[kids-draw:multiplayer] command share start", {
      requestId,
    });
    if (options.isSharingAllowed && !options.isSharingAllowed()) {
      return;
    }
    if (options.requestSharePermission) {
      const permitted = await options.requestSharePermission();
      if (
        !permitted ||
        options.isDestroyed() ||
        requestId !== shareRequestId ||
        (options.isSharingAllowed && !options.isSharingAllowed())
      ) {
        return;
      }
    }
    options.toolbarUiStore.setSharePending(true);
    try {
      await options.shareCurrentDocument();
      console.info("[kids-draw:multiplayer] command share success", {
        requestId,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.warn("[kids-draw:share] failed to share drawing", { error });
      console.warn("[kids-draw:multiplayer] command share error detail", {
        requestId,
        elapsedMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Failed to share this drawing.";
      options.onShareError?.(message);
    } finally {
      if (!options.isDestroyed() && requestId === shareRequestId) {
        options.toolbarUiStore.setSharePending(false);
      }
    }
  };

  return {
    undo(): void {
      options.loadedDocumentCommands.run(() => {
        options.store.undo();
      });
    },
    redo(): void {
      options.loadedDocumentCommands.run(() => {
        options.store.redo();
      });
    },
    clear(): void {
      options.loadedDocumentCommands.run(async () => {
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
      });
    },
    exportAndClose(): void {
      options.loadedDocumentCommands.run(exportDrawing);
    },
    newDrawingAndClose(): void {
      void newDrawing();
    },
    browseAndClose(): void {
      void options.openDocumentPicker();
    },
    shareAndClose(): void {
      options.loadedDocumentCommands.run(shareCurrentDocument);
    },
    destroy(): void {
      newDrawingRequestId += 1;
      shareRequestId += 1;
    },
  } satisfies KidsDrawCommandController;
}
