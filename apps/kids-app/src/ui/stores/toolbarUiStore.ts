import type { DrawingStore, ToolStyleSupport } from "@smalldraw/core";
import { atom } from "nanostores";

export interface ToolbarUiState {
  activeToolId: string;
  activeFamilyId: string;
  canUndo: boolean;
  canRedo: boolean;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  supportsStrokeColor: boolean;
  supportsStrokeWidth: boolean;
  supportsFillColor: boolean;
  newDrawingPending: boolean;
}

const DEFAULT_STATE: ToolbarUiState = {
  activeToolId: "",
  activeFamilyId: "",
  canUndo: false,
  canRedo: false,
  strokeColor: "#000000",
  fillColor: "#ffffff",
  strokeWidth: 2,
  supportsStrokeColor: true,
  supportsStrokeWidth: true,
  supportsFillColor: false,
  newDrawingPending: false,
};

export const $toolbarUi = atom<ToolbarUiState>(DEFAULT_STATE);

export function syncToolbarUiFromDrawingStore(
  store: DrawingStore,
  options?: {
    resolveActiveFamilyId?: (activeToolId: string) => string | null;
    resolveToolStyleSupport?: (activeToolId: string) => ToolStyleSupport;
  },
): void {
  const shared = store.getSharedSettings();
  const current = $toolbarUi.get();
  const activeToolId = store.getActiveToolId() ?? "";
  const activeFamilyId =
    options?.resolveActiveFamilyId?.(activeToolId) ?? current.activeFamilyId;
  const styleSupport = options?.resolveToolStyleSupport?.(activeToolId) ?? {};
  const next: ToolbarUiState = {
    ...current,
    activeToolId,
    activeFamilyId,
    canUndo: store.canUndo(),
    canRedo: store.canRedo(),
    strokeColor: shared.strokeColor,
    fillColor: shared.fillColor,
    strokeWidth: shared.strokeWidth,
    supportsStrokeColor: styleSupport.strokeColor ?? true,
    supportsStrokeWidth: styleSupport.strokeWidth ?? true,
    supportsFillColor: styleSupport.fillColor ?? false,
  };
  if (isEqual(current, next)) return;
  $toolbarUi.set(next);
}

export function setToolbarStyleUi(
  strokeColor: string,
  fillColor: string,
  strokeWidth: number,
): void {
  const current = $toolbarUi.get();
  const next: ToolbarUiState = {
    ...current,
    strokeColor,
    fillColor,
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
    a.fillColor === b.fillColor &&
    a.strokeWidth === b.strokeWidth &&
    a.supportsStrokeColor === b.supportsStrokeColor &&
    a.supportsStrokeWidth === b.supportsStrokeWidth &&
    a.supportsFillColor === b.supportsFillColor &&
    a.newDrawingPending === b.newDrawingPending
  );
}
