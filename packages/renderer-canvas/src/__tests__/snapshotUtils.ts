import type { DrawingDocument } from "@smalldraw/core";
import {
  expectSnapshot as expectSnapshotBase,
  resolveSnapshotDir,
} from "@smalldraw/testing";
import { renderDocument, type RenderDocumentOptions } from "../index";
import { createCanvas } from "canvas";

const SNAPSHOT_DIR = resolveSnapshotDir(import.meta.url);

export async function renderDocumentToImage(
  document: DrawingDocument,
  width: number,
  height: number,
  options?: RenderDocumentOptions,
): Promise<Buffer> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  renderDocument(ctx as unknown as CanvasRenderingContext2D, document, options);
  return canvas.toBuffer("image/png");
}

export async function expectSnapshot(
  buffer: Buffer,
  snapshotName: string,
  tolerance = 2,
): Promise<void> {
  return expectSnapshotBase(buffer, snapshotName, {
    snapshotDir: SNAPSHOT_DIR,
    testCommand: "bun --filter @smalldraw/renderer-canvas test",
    tolerance,
  });
}
