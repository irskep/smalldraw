import { describe, expect, test } from 'bun:test';

import { createDocument } from '../../model/document';
import { UndoManager } from '../../undo';
import { ToolRuntimeImpl } from '../runtime';
import { createPenTool } from '../pen';
import type { SharedToolSettings } from '../types';

describe('pen tool integration with runtime', () => {
  function setup(params?: { runtimeStrokeColor?: string; sharedSettings?: SharedToolSettings }) {
    const document = createDocument();
    const undoManager = new UndoManager();
    const runtimeOptions = params?.runtimeStrokeColor
      ? { stroke: { type: 'brush', color: params.runtimeStrokeColor, size: 5 } }
      : undefined;
    const runtime = new ToolRuntimeImpl({
      toolId: 'pen',
      document,
      undoManager,
      options: runtimeOptions,
      sharedSettings: params?.sharedSettings,
    });
    const tool = createPenTool();
    tool.activate(runtime);
    return { runtime, document, undoManager, tool };
  }

  test('collects pointer events into draft stroke and commits at pointer up', () => {
    const { runtime, document } = setup();

    runtime.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    runtime.dispatch('pointerMove', { point: { x: 10, y: 10 }, buttons: 1 });
    runtime.dispatch('pointerMove', { point: { x: 20, y: 5 }, buttons: 1 });

    expect(runtime.getDraft()?.geometry).toEqual({
      type: 'pen',
      points: [
        { x: 0, y: 0, pressure: undefined },
        { x: 10, y: 10, pressure: undefined },
        { x: 20, y: 5, pressure: undefined },
      ],
    });

    runtime.dispatch('pointerUp', { point: { x: 20, y: 5 }, buttons: 0 });

    expect(runtime.getDraft()).toBeNull();
    const shapeEntries = Object.entries(document.shapes);
    expect(shapeEntries).toHaveLength(1);
    const [, shape] = shapeEntries[0];
    expect(shape.geometry).toEqual({
      type: 'pen',
      points: [
        { x: 0, y: 0, pressure: undefined },
        { x: 10, y: 10, pressure: undefined },
        { x: 20, y: 5, pressure: undefined },
      ],
    });
  });

  test('uses runtime stroke options when provided', () => {
    const { runtime, document } = setup({ runtimeStrokeColor: '#ff00ff' });

    runtime.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    runtime.dispatch('pointerMove', { point: { x: 5, y: 5 }, buttons: 1 });
    runtime.dispatch('pointerUp', { point: { x: 5, y: 5 }, buttons: 0 });

    const shapeEntries = Object.values(document.shapes);
    expect(shapeEntries).toHaveLength(1);
    expect(shapeEntries[0].stroke?.color).toBe('#ff00ff');
  });

  test('falls back to shared settings for stroke defaults', () => {
    const shared: SharedToolSettings = {
      strokeColor: '#00ff00',
      strokeWidth: 7,
      fillColor: '#ffffff',
    };
    const { runtime, document } = setup({ sharedSettings: shared });
    runtime.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    runtime.dispatch('pointerMove', { point: { x: 2, y: 2 }, buttons: 1 });
    runtime.dispatch('pointerUp', { point: { x: 2, y: 2 }, buttons: 0 });

    const shape = Object.values(document.shapes)[0];
    expect(shape.stroke?.color).toBe('#00ff00');
    expect(shape.stroke?.size).toBe(7);
    expect(runtime.getSharedSettings().strokeWidth).toBe(7);
  });

  test('deactivation clears drafts and prevents further commits', () => {
    const { runtime, document, tool } = setup();

    runtime.dispatch('pointerDown', { point: { x: 1, y: 1 }, buttons: 1 });
    expect(runtime.getDraft()).not.toBeNull();

    tool.deactivate?.(runtime);
    expect(runtime.getDraft()).toBeNull();

    runtime.dispatch('pointerMove', { point: { x: 2, y: 2 }, buttons: 1 });
    runtime.dispatch('pointerUp', { point: { x: 2, y: 2 }, buttons: 0 });
    expect(Object.values(document.shapes)).toHaveLength(0);
  });
});
