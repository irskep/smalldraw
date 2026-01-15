import { createStage, renderDocument, type RenderDocumentOptions, type Viewport } from '../index';
import type { DrawingDocument } from '@smalldraw/core';
import { promises as fs } from 'fs';
import path from 'path';
import looksSame from 'looks-same';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_DIR = path.resolve(__dirname, '../../__snapshots__');
const SHOULD_UPDATE_SNAPSHOTS = process.env.UPDATE_SNAPSHOTS === '1';

export async function renderDocumentToImage(
  document: DrawingDocument,
  viewport: Viewport,
  options?: Omit<RenderDocumentOptions, 'viewport'>,
): Promise<Buffer> {
  const stage = createStage({ width: viewport.width, height: viewport.height });
  const layer = renderDocument(stage, document, { ...(options ?? {}), viewport });
  type BufferCanvas = HTMLCanvasElement & { toBuffer: (mimeType?: string) => Buffer };
  const canvas = layer.getCanvas()._canvas as BufferCanvas;
  return canvas.toBuffer('image/png');
}

export async function expectSnapshot(
  buffer: Buffer,
  snapshotName: string,
  tolerance = 2,
): Promise<void> {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  const snapshotPath = path.resolve(SNAPSHOT_DIR, `${snapshotName}.png`);
  let expected: Buffer;
  try {
    expected = await fs.readFile(snapshotPath);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      await fs.writeFile(snapshotPath, buffer);
      if (SHOULD_UPDATE_SNAPSHOTS) {
        return;
      }
      throw new Error(
        `Snapshot '${snapshotName}' did not exist. A new baseline was created at ${path.relative(
          process.cwd(),
          snapshotPath,
        )}. Verify it manually and rerun tests (or run with UPDATE_SNAPSHOTS=1 to accept automatically).`,
      );
    }
    throw error;
  }
  const match = await compareImages(buffer, expected, tolerance);
  if (match) {
    return;
  }
  if (SHOULD_UPDATE_SNAPSHOTS) {
    await fs.writeFile(snapshotPath, buffer);
    return;
  }
  const diffPath = path.resolve(SNAPSHOT_DIR, `${snapshotName}.diff.png`);
  await createDiff(buffer, expected, diffPath, tolerance);
  throw new Error(
    `Snapshot mismatch for '${snapshotName}'. See diff at ${path.relative(
      process.cwd(),
      diffPath,
    )}.` +
      ` Run UPDATE_SNAPSHOTS=1 bun --filter @smalldraw/renderer-konva test to accept changes.`,
  );
}

function compareImages(actual: Buffer, expected: Buffer, tolerance: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    looksSame(actual, expected, { tolerance }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Boolean(result && result.equal));
    });
  });
}

function createDiff(
  actual: Buffer,
  expected: Buffer,
  diffPath: string,
  tolerance: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    looksSame.createDiff(
      {
        reference: expected,
        current: actual,
        diff: diffPath,
        highlightColor: '#ff00ff',
        tolerance,
      },
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      },
    );
  });
}
