import { describe, expect, test } from 'bun:test';

import { AddShape, DeleteShape } from '../actions';
import { createDocument } from '../model/document';
import type { Shape } from '../model/shape';
import { canonicalizeShape } from '../model/shape';
import { UndoManager } from '../undo';

const rectangle: Shape = {
  id: 'rect-1',
  geometry: {
    type: 'rect',
    size: { width: 100, height: 50 },
  },
  fill: { type: 'solid', color: '#ff0000' },
  zIndex: 'a0',
  transform: {
    translation: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
  },
};

const canonicalRectangle = canonicalizeShape(rectangle);

describe('Undo stack interactions for rectangle shapes', () => {
  test('AddShape action can be undone/redone', () => {
    const doc = createDocument();
    const undo = new UndoManager();
    const addAction = new AddShape(rectangle);

    undo.apply(addAction, doc);
    expect(doc.shapes[rectangle.id]).toEqual(canonicalRectangle);
    expect(undo.canUndo()).toBe(true);
    expect(undo.canRedo()).toBe(false);

    expect(undo.undo(doc)).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toBeUndefined();
    expect(undo.canRedo()).toBe(true);

    expect(undo.redo(doc)).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toEqual(canonicalRectangle);
  });

  test('DeleteShape action restores removed rectangle on undo', () => {
    const doc = createDocument([rectangle]);
    const undo = new UndoManager();
    const deleteAction = new DeleteShape(rectangle.id);

    undo.apply(deleteAction, doc);
    expect(doc.shapes[rectangle.id]).toBeUndefined();

    expect(undo.undo(doc)).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toEqual(canonicalRectangle);

    expect(undo.redo(doc)).toBeTruthy();
    expect(doc.shapes[rectangle.id]).toBeUndefined();
  });
});
