import { describe, expect, test } from 'bun:test';

import { CompositeAction, UpdateShapeTransform } from '..';
import { createDocument } from '../../model/document';
import type { Shape } from '../../model/shape';
import { UndoManager } from '../../undo';

describe('UpdateShapeTransform action', () => {
  const baseShape: Shape = {
    id: 'shape-1',
    geometry: { type: 'rect', size: { width: 10, height: 10 } },
    zIndex: 'a',
    transform: {
      translation: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      origin: { x: 0, y: 0 },
    },
  };

  test('applies and undoes a single transform change', () => {
    const doc = createDocument([baseShape]);
    const undo = new UndoManager();
    const action = new UpdateShapeTransform('shape-1', {
      translation: { x: 5, y: -3 },
      rotation: Math.PI / 4,
      scale: { x: 2, y: 0.5 },
    });

    undo.apply(action, doc);
    expect(doc.shapes['shape-1']?.transform).toEqual({
      translation: { x: 5, y: -3 },
      rotation: Math.PI / 4,
      scale: { x: 2, y: 0.5 },
    });

    undo.undo(doc);
    expect(doc.shapes['shape-1']?.transform).toEqual(baseShape.transform);
  });

  test('composite action batches multiple transform updates', () => {
    const doc = createDocument([baseShape]);
    const undo = new UndoManager();
    const move = new UpdateShapeTransform('shape-1', {
      translation: { x: 10, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
    });
    const rotate = new UpdateShapeTransform('shape-1', {
      translation: { x: 10, y: 0 },
      rotation: Math.PI / 2,
      scale: { x: 1, y: 1 },
    });

    undo.apply(new CompositeAction([move, rotate]), doc);
    expect(doc.shapes['shape-1']?.transform).toEqual({
      translation: { x: 10, y: 0 },
      rotation: Math.PI / 2,
      scale: { x: 1, y: 1 },
    });

    undo.undo(doc);
    expect(doc.shapes['shape-1']?.transform).toEqual(baseShape.transform);
  });
});
