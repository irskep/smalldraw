import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'fs';
import path from 'path';
import looksSame from 'looks-same';
import { fileURLToPath } from 'url';

import { createDocument } from '@smalldraw/core';

import { createStage, renderDocument, type Viewport } from '../index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): [number, number, number, number] {
  const { data } = ctx.getImageData(Math.round(x), Math.round(y), 1, 1);
  return [data[0], data[1], data[2], data[3]];
}

function expectColor(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  target: [number, number, number, number],
  tolerance: number,
) {
  const actual = getPixel(ctx, point.x, point.y);
  for (let i = 0; i < 4; i += 1) {
    expect(Math.abs(actual[i] - target[i])).toBeLessThanOrEqual(tolerance);
  }
}

describe('renderDocument viewport behavior', () => {
  test('renders stroked circle centered in viewport', async () => {
    const circleDocument = createDocument([
      {
        id: 'circle',
        zIndex: 'a',
        geometry: { type: 'ellipse', radiusX: 5, radiusY: 5 },
        stroke: { type: 'brush', color: '#000000', size: 1 },
      },
    ]);

    const viewport: Viewport = {
      width: 100,
      height: 100,
      center: { x: 0, y: 0 },
      scale: 1,
      backgroundColor: '#ffffff',
    };

    const stage = createStage({ width: viewport.width, height: viewport.height });
    const layer = renderDocument(stage, circleDocument, { viewport });

    const canvas = layer.getCanvas()._canvas as unknown as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Expected 2d context');
    }

    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    // background should remain white at the center because circle has no fill
    expectColor(context, center, [255, 255, 255, 255], 5);

    // sample a pixel on the top of the circle's stroke
    const strokePoint = { x: center.x, y: center.y - 5 };
    expectColor(context, strokePoint, [0, 0, 0, 255], 130);

    // outside the stroke background returns to white
    const outsidePoint = { x: center.x, y: center.y - 8 };
    expectColor(context, outsidePoint, [255, 255, 255, 255], 5);

    // verify the upper-left corner stays white, ensuring background fill worked
    expectColor(context, { x: 0, y: 0 }, [255, 255, 255, 255], 5);

    const actualBuffer = canvas.toBuffer('image/png');
    await expectMatchesSnapshot(actualBuffer, 'circle');
  });
});

async function expectMatchesSnapshot(actual: Buffer, snapshotName: string): Promise<void> {
  const snapshotPath = path.resolve(
    __dirname,
    '../../__snapshots__',
    `${snapshotName}.png`,
  );
  const expected = await fs.readFile(snapshotPath);
  const equal = await compareImages(actual, expected);
  if (equal) {
    return;
  }
  const diffPath = path.resolve(
    __dirname,
    '../../__snapshots__',
    `${snapshotName}.diff.png`,
  );
  await createDiff(actual, expected, diffPath);
  throw new Error(
    `Snapshot mismatch for ${snapshotName}. Diff written to ${path.relative(process.cwd(), diffPath)}`,
  );
}

function compareImages(actual: Buffer, expected: Buffer): Promise<boolean> {
  return new Promise((resolve, reject) => {
    looksSame(actual, expected, { tolerance: 2 }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result.equal);
    });
  });
}

function createDiff(actual: Buffer, expected: Buffer, diffPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    looksSame.createDiff(
      {
        reference: expected,
        current: actual,
        diff: diffPath,
        highlightColor: '#ff00ff',
        tolerance: 2,
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
