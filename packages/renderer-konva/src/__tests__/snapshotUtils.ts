import type { DrawingDocument, ShapeHandlerRegistry } from "@smalldraw/core";
import {
  expectSnapshot as expectSnapshotBase,
  resolveSnapshotDir,
} from "@smalldraw/testing";
import {
  createStage,
  type RenderDocumentOptions,
  renderDocument,
  type Viewport,
} from "../index";

const SNAPSHOT_DIR = resolveSnapshotDir(import.meta.url);

export async function renderDocumentToImage(
  document: DrawingDocument,
  viewport: Viewport,
  options?: Omit<RenderDocumentOptions, "viewport">,
  geometryHandlerRegistry?: ShapeHandlerRegistry,
): Promise<Buffer> {
  const stage = createStage({ width: viewport.width, height: viewport.height });
  const layer = renderDocument(stage, document, {
    ...(options ?? {}),
    viewport,
    geometryHandlerRegistry,
  });
  type BufferCanvas = HTMLCanvasElement & {
    toBuffer: (mimeType?: string) => Buffer;
  };
  const canvas = layer.getCanvas()._canvas as BufferCanvas;
  return canvas.toBuffer("image/png");
}

export async function expectSnapshot(
  buffer: Buffer,
  snapshotName: string,
  tolerance = 2,
): Promise<void> {
  return expectSnapshotBase(buffer, snapshotName, {
    snapshotDir: SNAPSHOT_DIR,
    testCommand: "bun --filter @smalldraw/renderer-konva test",
    tolerance,
  });
}
