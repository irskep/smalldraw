import type { DrawingDocument } from "@smalldraw/core";
import {
  expectSnapshot as expectSnapshotBase,
  resolveSnapshotDir,
} from "@smalldraw/testing";
import { createCanvas } from "canvas";
import { type RenderDocumentOptions, renderDocument } from "../index";

const SNAPSHOT_DIR = resolveSnapshotDir(import.meta.url);

export async function renderDocumentToImage(
  document: DrawingDocument,
  width: number,
  height: number,
  options: RenderDocumentOptions & { background?: string },
): Promise<Buffer> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const background = options.background;
  if (background) {
    const renderCtx = ctx as unknown as CanvasRenderingContext2D;
    renderCtx.fillStyle = background;
    renderCtx.fillRect(0, 0, width, height);
  }
  const { background: _bg, ...renderOptions } = options;
  renderDocument(
    ctx as unknown as CanvasRenderingContext2D,
    document,
    renderOptions,
  );
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
