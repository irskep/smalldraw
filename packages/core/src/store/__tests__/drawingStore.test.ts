import { describe, expect, test } from 'bun:test';

import { DrawingStore } from '../drawingStore';
import { createPenTool } from '../../tools/pen';
import { createRectangleTool } from '../../tools/rectangle';
import type { ToolDefinition } from '../../tools/types';

function createDraftTool(): ToolDefinition {
  return {
    id: 'draft-tool',
    label: 'Draft Tool',
    activate(runtime) {
      runtime.on('pointerDown', (event) => {
        runtime.setDraft({
          toolId: runtime.toolId,
          temporary: true,
          id: 'draft-1',
          geometry: {
            type: 'rect',
            size: { width: 10, height: 10 },
          },
          zIndex: runtime.getNextZIndex(),
          fill: { type: 'solid', color: '#ff0000' },
          transform: {
            translation: event.point,
            scale: { x: 1, y: 1 },
            rotation: 0,
          },
        });
      });
    },
    deactivate(runtime) {
      runtime.clearDraft();
    },
  };
}

function createSharedSettingsUpdater(): ToolDefinition {
  return {
    id: 'settings-updater',
    label: 'Settings Updater',
    activate(runtime) {
      runtime.on('pointerDown', () => {
        runtime.updateSharedSettings({ strokeWidth: 9 });
      });
    },
  };
}

function createSharedSettingsReader(record: { width: number }): ToolDefinition {
  return {
    id: 'settings-reader',
    label: 'Settings Reader',
    activate(runtime) {
      runtime.on('pointerDown', () => {
        record.width = runtime.getSharedSettings().strokeWidth;
      });
    },
  };
}

function createSelectionTool(record: { selectionSize: number }): ToolDefinition {
  return {
    id: 'selection-tool',
    label: 'Selection Tool',
    activate(runtime) {
      runtime.on('pointerDown', () => {
        runtime.setSelection(['a', 'b']);
        record.selectionSize = runtime.getSelection().ids.size;
      });
    },
  };
}

describe('DrawingStore', () => {
  test('activating pen tool and dispatching pointer events commits shapes', () => {
    const store = new DrawingStore({ tools: [createPenTool()] });
    store.activateTool('pen');
    store.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    store.dispatch('pointerMove', { point: { x: 5, y: 5 }, buttons: 1 });
    store.dispatch('pointerUp', { point: { x: 5, y: 5 }, buttons: 0 });

    const shapes = Object.values(store.getDocument().shapes);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].geometry).toEqual({
      type: 'pen',
      points: [
        { x: 0, y: 0, pressure: undefined },
        { x: 5, y: 5, pressure: undefined },
      ],
    });
  });

  test('store aggregates drafts from multiple tools', () => {
    const store = new DrawingStore({
      tools: [createDraftTool(), createPenTool()],
    });
    store.activateTool('draft-tool');
    store.dispatch('pointerDown', { point: { x: 10, y: 10 }, buttons: 1 });

    expect(store.getDrafts()).toHaveLength(1);
    expect(store.getDrafts()[0]?.geometry).toEqual({
      type: 'rect',
      size: { width: 10, height: 10 },
    });

    store.activateTool('pen');
    expect(store.getDrafts()).toEqual([]);
  });

  test('shared settings updates persist across tools', () => {
    const record = { width: 0 };
    const store = new DrawingStore({
      tools: [createSharedSettingsUpdater(), createSharedSettingsReader(record)],
    });
    store.activateTool('settings-updater');
    store.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });

    store.activateTool('settings-reader');
    store.dispatch('pointerDown', { point: { x: 1, y: 1 }, buttons: 1 });
    expect(record.width).toBe(9);
  });

  test('selection state is shared across runtimes', () => {
    const record = { selectionSize: 0 };
    const store = new DrawingStore({
      tools: [createSelectionTool(record)],
    });
    store.activateTool('selection-tool');
    store.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    expect(record.selectionSize).toBe(2);
  });

  test('rectangle shapes record resizable interactions while pen strokes do not', () => {
    const store = new DrawingStore({ tools: [createPenTool(), createRectangleTool()] });
    store.activateTool('pen');
    store.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    store.dispatch('pointerMove', { point: { x: 5, y: 5 }, buttons: 1 });
    store.dispatch('pointerUp', { point: { x: 5, y: 5 }, buttons: 0 });

    store.activateTool('rect');
    store.dispatch('pointerDown', { point: { x: 10, y: 10 }, buttons: 1 });
    store.dispatch('pointerMove', { point: { x: 20, y: 25 }, buttons: 1 });
    store.dispatch('pointerUp', { point: { x: 20, y: 25 }, buttons: 0 });

    const shapes = Object.values(store.getDocument().shapes);
    const penShape = shapes.find((shape) => shape.geometry.type === 'pen');
    const rectShape = shapes.find((shape) => shape.geometry.type === 'rect');
    expect(penShape?.interactions?.resizable).toBe(false);
    expect(rectShape?.interactions?.resizable).toBe(true);
  });
});
