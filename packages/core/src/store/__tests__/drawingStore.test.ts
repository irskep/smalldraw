import { describe, expect, test } from 'bun:test';

import { DrawingStore } from '../drawingStore';
import { createPenTool } from '../../tools/pen';
import { createRectangleTool } from '../../tools/rectangle';
import { createSelectionTool as createSelectionDefinition } from '../../tools/selection';
import { createDocument } from '../../model/document';
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

function createSelectionSetterTool(record: { selectionSize: number }): ToolDefinition {
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

function createRuntimeSelectionTool(selectionIds: string[]): ToolDefinition {
  const selectionDef = createSelectionDefinition();
  return {
    id: 'selection',
    label: 'Selection',
    activate(runtime) {
      runtime.setSelection(selectionIds);
      selectionDef.activate(runtime);
    },
    deactivate(runtime) {
      selectionDef.deactivate?.(runtime);
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
        { x: -2.5, y: -2.5, pressure: undefined },
        { x: 2.5, y: 2.5, pressure: undefined },
      ],
    });
    expect(shapes[0].transform?.translation).toEqual({ x: 2.5, y: 2.5 });
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
      tools: [createSelectionSetterTool(record)],
    });
    store.activateTool('selection-tool');
    store.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    expect(record.selectionSize).toBe(2);
  });

  test('rectangle and pen shapes record resizable interactions', () => {
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
    expect(penShape?.interactions?.resizable).toBe(true);
    expect(rectShape?.interactions?.resizable).toBe(true);
  });

  test('selection frame updates can be read from store', () => {
    const doc = createDocument([
      {
        id: 'rect-frame',
        geometry: { type: 'rect', size: { width: 10, height: 10 } },
        zIndex: 'frame',
        interactions: { resizable: true, rotatable: true },
        transform: {
          translation: { x: 5, y: 5 },
          rotation: 0,
          scale: { x: 1, y: 1 },
        },
      },
    ]);
    const store = new DrawingStore({
      document: doc,
      tools: [createRuntimeSelectionTool(['rect-frame'])],
    });
    store.activateTool('selection');
    expect(store.getSelectionFrame()).toBeNull();

    store.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    store.dispatch('pointerMove', { point: { x: 5, y: 5 }, buttons: 1 });
    expect(store.getSelectionFrame()).toEqual({
      minX: 5,
      minY: 5,
      maxX: 15,
      maxY: 15,
      width: 10,
      height: 10,
    });
  });

  test('store exposes handles and hover events for selection tool', () => {
    const doc = createDocument([
      {
        id: 'rect',
        geometry: { type: 'rect', size: { width: 10, height: 10 } },
        zIndex: 'a',
        interactions: { resizable: true, rotatable: true },
        transform: {
          translation: { x: 0, y: 0 },
          rotation: 0,
          scale: { x: 1, y: 1 },
        },
      },
    ]);
    const store = new DrawingStore({
      document: doc,
      tools: [createRuntimeSelectionTool(['rect']), createPenTool()],
    });
    store.activateTool('selection');
    expect(store.getHandles().length).toBeGreaterThan(0);

    store.dispatch('pointerMove', {
      point: { x: 0, y: 0 },
      buttons: 0,
      handleId: 'top-left',
      shiftKey: true,
    });
    expect(store.getHandleHover()).toEqual({
      handleId: 'top-left',
      behavior: { type: 'resize', proportional: true },
    });

    store.dispatch('pointerMove', { point: { x: 5, y: 5 }, buttons: 0 });
    expect(store.getHandleHover()).toEqual({ handleId: null, behavior: null });

    store.activateTool('pen');
    expect(store.getHandles()).toEqual([]);
    expect(store.getHandleHover()).toEqual({ handleId: null, behavior: null });
  });
});
