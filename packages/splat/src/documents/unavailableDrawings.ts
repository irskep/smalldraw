import { atom } from "nanostores";

// Session-local: a reload revalidates access with the server. Keep device copies intact.
export const $unavailableDrawings = atom<ReadonlySet<string>>(new Set());
export function markDrawingUnavailable(id: string): void {
  if ($unavailableDrawings.get().has(id)) return;
  $unavailableDrawings.set(new Set([...$unavailableDrawings.get(), id]));
}
