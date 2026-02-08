import type { DrawingStore, SmalldrawCore } from "@smalldraw/core";
import type { IconNode } from "lucide";

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
  confirmDestructiveAction?: (dialog: ConfirmDialogRequest) => Promise<boolean>;
}

export interface KidsDrawApp {
  readonly element: HTMLElement;
  readonly store: DrawingStore;
  readonly overlay: HTMLElement;
  readonly core: SmalldrawCore;
  destroy(): void;
}
