import { atom } from "nanostores";
import type { DrawingStore } from "@smalldraw/core";

export interface ToolbarUiState {
  activeToolId: string;
  canUndo: boolean;
  canRedo: boolean;
  strokeColor: string;
  strokeWidth: number;
  newDrawingPending: boolean;
}

const DEFAULT_STATE: ToolbarUiState = {
  activeToolId: "",
  canUndo: false,
  canRedo: false,
  strokeColor: "#000000",
  strokeWidth: 2,
  newDrawingPending: false,
};

export const $toolbarUi = atom<ToolbarUiState>(DEFAULT_STATE);

export function syncToolbarUiFromDrawingStore(store: DrawingStore): void {
  const shared = store.getSharedSettings();
  const current = $toolbarUi.get();
  const next: ToolbarUiState = {
    ...current,
    activeToolId: store.getActiveToolId() ?? "",
    canUndo: store.canUndo(),
    canRedo: store.canRedo(),
    strokeColor: shared.strokeColor,
    strokeWidth: shared.strokeWidth,
  };
  if (isEqual(current, next)) return;
  $toolbarUi.set(next);
}

export function setToolbarStrokeUi(strokeColor: string, strokeWidth: number): void {
  const current = $toolbarUi.get();
  const next: ToolbarUiState = {
    ...current,
    strokeColor,
    strokeWidth,
  };
  if (isEqual(current, next)) return;
  $toolbarUi.set(next);
}

export function setNewDrawingPending(newDrawingPending: boolean): void {
  const current = $toolbarUi.get();
  if (current.newDrawingPending === newDrawingPending) return;
  $toolbarUi.set({ ...current, newDrawingPending });
}

function isEqual(a: ToolbarUiState, b: ToolbarUiState): boolean {
  return (
    a.activeToolId === b.activeToolId &&
    a.canUndo === b.canUndo &&
    a.canRedo === b.canRedo &&
    a.strokeColor === b.strokeColor &&
    a.strokeWidth === b.strokeWidth &&
    a.newDrawingPending === b.newDrawingPending
  );
}
