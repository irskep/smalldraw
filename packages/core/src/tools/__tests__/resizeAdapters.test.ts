import { describe, expect, test } from 'bun:test';

import { __getResizeAdapterForTest, RESIZABLE_GEOMETRY_TYPES } from '../selection';
import type { Shape } from '../../model/shape';

function makeShape(id: string, geometry: Shape['geometry']): Shape {
  return {
    id,
    geometry,
    zIndex: id,
    interactions: { resizable: true },
    transform: {
      translation: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
    },
  };
}

describe('selection resize adapters', () => {
  test('adapters exist for each supported geometry type', () => {
    const shapes: Shape[] = [
      makeShape('rect', { type: 'rect', size: { width: 10, height: 10 } }),
      makeShape('ellipse', { type: 'ellipse', radiusX: 10, radiusY: 5 }),
      makeShape('regularPolygon', { type: 'regularPolygon', radius: 10, sides: 5 }),
      makeShape('pen', { type: 'pen', points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] }),
    ];

    for (const shape of shapes) {
      const adapter = __getResizeAdapterForTest(shape);
      expect(adapter).not.toBeNull();
    }
  });

  test('non-supported geometry types fall back to translation', () => {
    const polygonShape = makeShape('poly', {
      type: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ],
    });
    const pathShape = makeShape('path', {
      type: 'path',
      segments: [{ type: 'move', points: [{ x: 0, y: 0 }] }],
    });
    polygonShape.interactions = { resizable: true };
    pathShape.interactions = { resizable: true };

    expect(__getResizeAdapterForTest(polygonShape)).toBeNull();
    expect(__getResizeAdapterForTest(pathShape)).toBeNull();
  });

  test('documented geometry types match adapter registry', () => {
    const supported = new Set(RESIZABLE_GEOMETRY_TYPES);
    expect(supported.has('rect')).toBe(true);
    expect(supported.has('ellipse')).toBe(true);
    expect(supported.has('regularPolygon')).toBe(true);
    expect(supported.has('pen')).toBe(true);
  });
});
