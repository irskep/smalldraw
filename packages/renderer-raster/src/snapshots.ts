import type { TileSnapshotStore } from "./types";

export function createInMemorySnapshotStore<
  TSnapshot,
>(): TileSnapshotStore<TSnapshot> {
  const snapshots = new Map<string, TSnapshot>();
  return {
    getSnapshot: (key) => snapshots.get(key),
    setSnapshot: (key, snapshot) => {
      snapshots.set(key, snapshot);
    },
    deleteSnapshot: (key) => {
      snapshots.delete(key);
    },
    clearSnapshots: () => {
      snapshots.clear();
    },
  };
}
