import { describe, test } from 'bun:test';

import { createDocument, type Shape } from '@smalldraw/core';

import type { Viewport } from '../index';
import { expectSnapshot, renderDocumentToImage } from './snapshotUtils';

const baseViewport: Viewport = {
  width: 120,
  height: 120,
  center: { x: 0, y: 0 },
  scale: 1,
  backgroundColor: '#ffffff',
};

async function expectDocumentSnapshot(
  name: string,
  shapes: Shape[],
  viewport: Viewport = baseViewport,
) {
  const document = createDocument(shapes);
  const image = await renderDocumentToImage(document, viewport);
  await expectSnapshot(image, name);
}

describe('renderer snapshots', () => {
  test('circle stroke baseline', async () => {
    await expectDocumentSnapshot('circle', [
      {
        id: 'circle',
        zIndex: 'a',
        geometry: { type: 'ellipse', radiusX: 5, radiusY: 5 },
        stroke: { type: 'brush', color: '#000000', size: 1 },
      },
    ]);
  });

  test('solid rectangle with stroke', async () => {
    await expectDocumentSnapshot('rectangle-solid', [
      {
        id: 'solid-rect',
        zIndex: 'a',
        geometry: { type: 'rect', size: { width: 80, height: 60 } },
        fill: { type: 'solid', color: '#2E7D32' },
        stroke: { type: 'brush', color: '#0D47A1', size: 4 },
        transform: { translation: { x: -15, y: 0 } },
      },
    ]);
  });

  test('gradient ellipse fills', async () => {
    await expectDocumentSnapshot('ellipse-gradient', [
      {
        id: 'gradient-ellipse',
        zIndex: 'a',
        geometry: { type: 'ellipse', radiusX: 50, radiusY: 30 },
        fill: {
          type: 'gradient',
          angle: 90,
          stops: [
            { offset: 0, color: '#ff7043' },
            { offset: 1, color: '#1e88e5' },
          ],
        },
        stroke: { type: 'brush', color: '#212121', size: 2 },
        transform: { translation: { x: 0, y: 0 } },
      },
    ], {
      width: 200,
      height: 160,
      center: { x: 0, y: 0 },
      scale: 1,
      backgroundColor: '#ffffff',
    });
  });

  test('polygons and regular polygons', async () => {
    await expectDocumentSnapshot('polygons', [
      {
        id: 'polygon',
        zIndex: 'a',
        geometry: {
          type: 'polygon',
          points: [
            { x: -60, y: 30 },
            { x: -20, y: -40 },
            { x: 30, y: -10 },
            { x: 10, y: 40 },
          ],
          closed: true,
        },
        fill: { type: 'solid', color: '#00897b' },
        stroke: { type: 'brush', color: '#004d40', size: 2 },
      },
      {
        id: 'regular',
        zIndex: 'b',
        geometry: { type: 'regularPolygon', radius: 25, sides: 5 },
        fill: { type: 'solid', color: '#ffc107' },
        stroke: { type: 'brush', color: '#ff6f00', size: 2 },
        transform: { translation: { x: 40, y: 10 } },
      },
    ], {
      width: 220,
      height: 180,
      center: { x: 0, y: 0 },
      scale: 1,
      backgroundColor: '#ffffff',
    });
  });

  test('paths and bezier curves', async () => {
    await expectDocumentSnapshot('paths-bezier', [
      {
        id: 'path-shape',
        zIndex: 'a',
        geometry: {
          type: 'path',
          segments: [
            { type: 'move', points: [{ x: -80, y: -20 }] },
            { type: 'line', points: [{ x: -20, y: -20 }, { x: 0, y: -50 }] },
            {
              type: 'bezier',
              points: [
                { x: 40, y: -50 },
                { x: 40, y: 20 },
                { x: 0, y: 20 },
              ],
            },
            { type: 'line', points: [{ x: -60, y: 40 }] },
          ],
        },
        stroke: { type: 'brush', color: '#6a1b9a', size: 3 },
      },
      {
        id: 'bezier-shape',
        zIndex: 'b',
        geometry: {
          type: 'bezier',
          nodes: [
            {
              anchor: { x: -10, y: 60 },
              handleOut: { x: 20, y: 40 },
            },
            {
              anchor: { x: 40, y: 60 },
              handleIn: { x: 10, y: 80 },
              handleOut: { x: 60, y: 80 },
            },
            {
              anchor: { x: 70, y: 30 },
              handleIn: { x: 70, y: 55 },
            },
          ],
        },
        stroke: { type: 'brush', color: '#ad1457', size: 4 },
      },
    ], {
      width: 240,
      height: 200,
      center: { x: 0, y: 0 },
      scale: 1,
      backgroundColor: '#ffffff',
    });
  });

  test('pen strokes and raw strokes', async () => {
    await expectDocumentSnapshot('pen-strokes', [
      {
        id: 'pen-shape',
        zIndex: 'a',
        geometry: {
          type: 'pen',
          points: [
            { x: -80, y: -10 },
            { x: -40, y: -30 },
            { x: -10, y: -5 },
            { x: 20, y: -35 },
            { x: 60, y: 0 },
            { x: 30, y: 30 },
          ],
          simulatePressure: true,
        },
        stroke: { type: 'brush', color: '#e65100', size: 10 },
      },
      {
        id: 'polyline-stroke',
        zIndex: 'b',
        geometry: {
          type: 'stroke',
          points: [
            { x: -80, y: 40 },
            { x: -20, y: 20 },
            { x: 0, y: 50 },
            { x: 60, y: 40 },
          ],
        },
        stroke: { type: 'brush', color: '#1e88e5', size: 4 },
      },
    ], {
      width: 260,
      height: 180,
      center: { x: 0, y: 0 },
      scale: 1,
      backgroundColor: '#ffffff',
    });
  });

  test('transforms: rotation and scaling', async () => {
    await expectDocumentSnapshot('transforms', [
      {
        id: 'rotated-rect',
        zIndex: 'a',
        geometry: { type: 'rect', size: { width: 80, height: 40 } },
        fill: { type: 'solid', color: '#26c6da' },
        stroke: { type: 'brush', color: '#00838f', size: 3 },
        transform: {
          translation: { x: -20, y: -10 },
          rotation: Math.PI / 4,
        },
      },
      {
        id: 'scaled-ellipse',
        zIndex: 'b',
        geometry: { type: 'ellipse', radiusX: 30, radiusY: 20 },
        fill: { type: 'solid', color: '#f06292' },
        stroke: { type: 'brush', color: '#880e4f', size: 2 },
        transform: {
          translation: { x: 40, y: 20 },
          scale: { x: 1.5, y: 0.7 },
          rotation: Math.PI / 6,
        },
      },
    ], {
      width: 240,
      height: 200,
      center: { x: 0, y: 0 },
      scale: 1,
      backgroundColor: '#ffffff',
    });
  });
});
