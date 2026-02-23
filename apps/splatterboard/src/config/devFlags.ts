const LAYOUT_DEBUG_STORAGE_KEY = "kd.debug.layout";

export function isLayoutDebugEnabled(): boolean {
  const globalWithFlag = window as Window & {
    __KD_DEBUG_LAYOUT__?: boolean;
  };
  if (globalWithFlag.__KD_DEBUG_LAYOUT__ === true) {
    return true;
  }
  try {
    return window.localStorage.getItem(LAYOUT_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
