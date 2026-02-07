import {
  expectSnapshot as expectSnapshotBase,
  resolveSnapshotDir,
} from "@smalldraw/testing";

const SNAPSHOT_DIR = resolveSnapshotDir(import.meta.url);

export async function expectSnapshot(
  buffer: Buffer,
  snapshotName: string,
  tolerance = 2,
): Promise<void> {
  return expectSnapshotBase(buffer, snapshotName, {
    snapshotDir: SNAPSHOT_DIR,
    testCommand: "bun --filter @smalldraw/renderer-canvas-tiles test",
    tolerance,
  });
}
