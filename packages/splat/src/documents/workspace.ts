/** Every cache and cross-tab channel belongs to one guest or account workspace. */
export type DrawingWorkspace = string | null;
const KEY = "drawing-workspace";
let workspace: DrawingWorkspace = null;

export function getDrawingWorkspace(): DrawingWorkspace {
  return workspace;
}
export function setDrawingWorkspace(value: DrawingWorkspace): void {
  workspace = value;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(value));
  }
}
export function getLastDrawingWorkspace(): DrawingWorkspace {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}
export function workspaceNames(id: DrawingWorkspace = workspace) {
  const suffix = id === null ? "" : `:account:${encodeURIComponent(id)}`;
  return {
    catalog: `kids-draw-documents${suffix}`,
    current: `kids-draw-doc-url${suffix}`,
    repo: `automerge${suffix}`,
    channel: `drawing-repo${suffix}`,
    lock: `drawing-writers${suffix}`,
  };
}
