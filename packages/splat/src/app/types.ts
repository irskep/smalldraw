import type { DrawingStore, SmalldrawCore } from "@smalldraw/core";
import type { IconNode } from "lucide";
import type { KidsDocumentBackend } from "../documents";

export interface ConfirmDialogRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: IconNode;
}

export interface KidsDrawAppOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  backgroundColor?: string;
  core?: SmalldrawCore;
  documentBackend?: KidsDocumentBackend;
  confirmDestructiveAction?: (dialog: ConfirmDialogRequest) => Promise<boolean>;
  savePngExport?: (input: {
    suggestedName: string;
    blob?: Blob;
    dataUrl?: string;
  }) => Promise<boolean>;
}

export interface KidsDrawAppCommands {
  undo(): void;
  redo(): void;
  clear(): void;
  export(): void;
  newDrawing(): void;
  browse(): void;
}

export interface KidsDrawApp {
  readonly element: HTMLElement;
  readonly store: DrawingStore;
  readonly overlay: HTMLElement;
  readonly core: SmalldrawCore;
  readonly commands: KidsDrawAppCommands;
  destroy(): void;
}
