import type { DrawingStore } from "@smalldraw/core";
import { atom } from "nanostores";

export interface ToolbarUiState {
  activeToolId: string;
  activeFamilyId: string;
  canUndo: boolean;
  canRedo: boolean;
  strokeColor: string;
  strokeWidth: number;
  newDrawingPending: boolean;
}

const DEFAULT_STATE: ToolbarUiState = {
  activeToolId: "",
  activeFamilyId: "",
  canUndo: false,
  canRedo: false,
  strokeColor: "#000000",
  strokeWidth: 2,
  newDrawingPending: false,
};

export const $toolbarUi = atom<ToolbarUiState>(DEFAULT_STATE);

export function syncToolbarUiFromDrawingStore(
  store: DrawingStore,
  options?: {
    resolveActiveFamilyId?: (activeToolId: string) => string | null;
  },
): void {
  const shared = store.getSharedSettings();
  const current = $toolbarUi.get();
  const activeToolId = store.getActiveToolId() ?? "";
  const activeFamilyId =
    options?.resolveActiveFamilyId?.(activeToolId) ?? current.activeFamilyId;
  const next: ToolbarUiState = {
    ...current,
    activeToolId,
    activeFamilyId,
    canUndo: store.canUndo(),
    canRedo: store.canRedo(),
    strokeColor: shared.strokeColor,
    strokeWidth: shared.strokeWidth,
  };
  if (isEqual(current, next)) return;
  $toolbarUi.set(next);
}

export function setToolbarStrokeUi(
  strokeColor: string,
  strokeWidth: number,
): void {
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
    a.activeFamilyId === b.activeFamilyId &&
    a.canUndo === b.canUndo &&
    a.canRedo === b.canRedo &&
    a.strokeColor === b.strokeColor &&
    a.strokeWidth === b.strokeWidth &&
    a.newDrawingPending === b.newDrawingPending
  );
}
