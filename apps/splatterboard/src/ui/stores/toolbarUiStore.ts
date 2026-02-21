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
  supportsTransparentStrokeColor: boolean;
  supportsTransparentFillColor: boolean;
  newDrawingPending: boolean;
}

export const UI_STATE_STORAGE_KEY_PREFIX = "kids-draw:ui-state:v1";

export interface PersistedKidsUiStateV1 {
  version: 1;
  activeToolId: string;
  strokeColor: string;
  strokeWidth: number;
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
  supportsTransparentStrokeColor: false,
  supportsTransparentFillColor: false,
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
    supportsTransparentStrokeColor:
      styleSupport.transparentStrokeColor ?? false,
    supportsTransparentFillColor: styleSupport.transparentFillColor ?? false,
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

export function getToolbarUiStorageKeyForDocument(docUrl: string): string {
  return `${UI_STATE_STORAGE_KEY_PREFIX}:${encodeURIComponent(docUrl)}`;
}

export function loadPersistedToolbarUiState(
  docUrl: string,
): PersistedKidsUiStateV1 | null {
  try {
    const raw = globalThis.localStorage?.getItem(
      getToolbarUiStorageKeyForDocument(docUrl),
    );
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isPersistedKidsUiStateV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePersistedToolbarUiState(
  docUrl: string,
  state: PersistedKidsUiStateV1,
): void {
  try {
    globalThis.localStorage?.setItem(
      getToolbarUiStorageKeyForDocument(docUrl),
      JSON.stringify(state),
    );
  } catch {
    // Ignore write failures (quota/security) so UI behavior stays unaffected.
  }
}

function isPersistedKidsUiStateV1(
  value: unknown,
): value is PersistedKidsUiStateV1 {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PersistedKidsUiStateV1>;
  return (
    candidate.version === 1 &&
    typeof candidate.activeToolId === "string" &&
    typeof candidate.strokeColor === "string" &&
    typeof candidate.strokeWidth === "number"
  );
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
    a.supportsTransparentStrokeColor === b.supportsTransparentStrokeColor &&
    a.supportsTransparentFillColor === b.supportsTransparentFillColor &&
    a.newDrawingPending === b.newDrawingPending
  );
}
