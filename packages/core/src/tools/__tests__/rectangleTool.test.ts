import { describe, expect, test } from 'bun:test';

import { createDocument } from '../../model/document';
import { UndoManager } from '../../undo';
import { ToolRuntimeImpl } from '../runtime';
import { createRectangleTool } from '../rectangle';
import type { SharedToolSettings } from '../types';

function setup(params?: { sharedSettings?: SharedToolSettings }) {
  const document = createDocument();
  const undoManager = new UndoManager();
  const runtime = new ToolRuntimeImpl({
    toolId: 'rect',
    document,
    undoManager,
    sharedSettings: params?.sharedSettings,
  });
  const tool = createRectangleTool();
  tool.activate(runtime);
  return { runtime, document, tool };
}

describe('rectangle tool', () => {
  test('creates rectangle geometry from pointer drag', () => {
    const { runtime, document } = setup();
    runtime.dispatch('pointerDown', { point: { x: 10, y: 10 }, buttons: 1 });
    runtime.dispatch('pointerMove', { point: { x: 30, y: 40 }, buttons: 1 });

    const draft = runtime.getDraft();
    expect(draft?.geometry).toEqual({
      type: 'rect',
      size: { width: 20, height: 30 },
    });

    runtime.dispatch('pointerUp', { point: { x: 30, y: 40 }, buttons: 0 });
    expect(Object.values(document.shapes)).toHaveLength(1);
    const shape = Object.values(document.shapes)[0];
    expect(draft).toBeDefined();
    expect(shape.geometry).toEqual(draft!.geometry);
    expect(shape.transform?.translation).toEqual({ x: 20, y: 25 });
    expect(shape.interactions?.resizable).toBe(true);
  });

  test('uses shared fill color by default', () => {
    const shared: SharedToolSettings = {
      strokeColor: '#111111',
      strokeWidth: 4,
      fillColor: '#abcdef',
    };
    const { runtime, document } = setup({ sharedSettings: shared });
    runtime.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    runtime.dispatch('pointerMove', { point: { x: 10, y: 10 }, buttons: 1 });
    runtime.dispatch('pointerUp', { point: { x: 10, y: 10 }, buttons: 0 });

    const shape = Object.values(document.shapes)[0];
    expect(shape.fill?.type).toBe('solid');
    if (shape.fill?.type === 'solid') {
      expect(shape.fill.color).toBe('#abcdef');
    }
    expect(shape.stroke?.color).toBe('#111111');
    expect(shape.stroke?.size).toBe(4);
  });
});
