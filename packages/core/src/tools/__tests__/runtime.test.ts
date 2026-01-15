import { describe, expect, test } from 'bun:test';

import { AddShape } from '../../actions';
import { createDocument } from '../../model/document';
import type { Shape } from '../../model/shape';
import { UndoManager } from '../../undo';
import { getZIndexBetween } from '../../zindex';
import type { SelectionState, SharedToolSettings } from '../types';
import { ToolRuntimeImpl } from '../runtime';

interface RuntimeOverrides {
  options?: Record<string, unknown>;
  sharedSettings?: SharedToolSettings;
  selectionState?: SelectionState;
  toolStates?: Map<string, unknown>;
}

function createRuntime(overrides?: RuntimeOverrides) {
  const document = createDocument();
  const undoManager = new UndoManager();
  const draftChanges: Array<unknown> = [];
  const runtime = new ToolRuntimeImpl({
    toolId: 'pen',
    document,
    undoManager,
    options: overrides?.options,
    onDraftChange: (draft) => draftChanges.push(draft),
    sharedSettings: overrides?.sharedSettings,
    selectionState: overrides?.selectionState,
    toolStates: overrides?.toolStates,
  });
  return { runtime, document, undoManager, draftChanges };
}

describe('ToolRuntimeImpl', () => {
  test('registers event handlers and disposers', () => {
    const { runtime } = createRuntime();
    let count = 0;
    const disposer = runtime.on('pointerDown', () => {
      count += 1;
    });

    runtime.dispatch('pointerDown', { point: { x: 0, y: 0 }, buttons: 1 });
    expect(count).toBe(1);

    disposer();
    runtime.dispatch('pointerDown', { point: { x: 1, y: 1 }, buttons: 1 });
    expect(count).toBe(1);
  });

  test('setDraft stores draft and clearDraft resets it', () => {
    const { runtime, draftChanges } = createRuntime();
    runtime.setDraft({
      toolId: 'pen',
      temporary: true,
      id: 'draft-1',
      geometry: {
        type: 'pen',
        points: [{ x: 0, y: 0 }],
      },
      zIndex: 'a',
    });
    expect(runtime.getDraft()?.id).toBe('draft-1');
    runtime.clearDraft();
    expect(runtime.getDraft()).toBeNull();
    expect(draftChanges[draftChanges.length - 1]).toBeNull();
  });

  test('commit applies undoable action to the document', () => {
    const { runtime, document } = createRuntime();
    const shape: Shape = {
      id: 'rect-1',
      geometry: {
        type: 'rect',
        size: { width: 10, height: 10 },
      },
      zIndex: 'a',
      transform: {
        translation: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      },
    };

    runtime.commit(new AddShape(shape));
    expect(document.shapes[shape.id]).toEqual(shape);
  });

  test('getNextZIndex generates keys after top shape', () => {
    const zIndex = getZIndexBetween(null, null);
    const document = createDocument([
      {
        id: 'shape-1',
        geometry: {
          type: 'rect',
          size: { width: 10, height: 10 },
        },
        zIndex,
        transform: {
          translation: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotation: 0,
        },
      },
    ]);
    const undoManager = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: 'pen',
      document,
      undoManager,
    });
    const next = runtime.getNextZIndex();
    expect(next).not.toBe(zIndex);
  });

  test('returns tool options through getOptions', () => {
    const { runtime } = createRuntime({
      options: { stroke: { type: 'brush', color: '#f00', size: 3 } },
    });
    const options = runtime.getOptions<{ stroke: { color: string } }>();
    expect(options?.stroke.color).toBe('#f00');
  });

  test('shared settings can be read and updated', () => {
    const shared: SharedToolSettings = {
      strokeColor: '#0000ff',
      strokeWidth: 3,
      fillColor: '#cccccc',
    };
    const { runtime } = createRuntime({ sharedSettings: shared });
    expect(runtime.getSharedSettings().strokeColor).toBe('#0000ff');
    runtime.updateSharedSettings({ strokeWidth: 8 });
    expect(shared.strokeWidth).toBe(8);
    expect(runtime.getSharedSettings().strokeWidth).toBe(8);
  });

  test('tool state persists via shared map between runtimes', () => {
    const toolStates = new Map<string, unknown>();
    const first = createRuntime({ toolStates });
    first.runtime.setToolState({ sides: 5 });
    const second = createRuntime({ toolStates });
    expect(second.runtime.getToolState<{ sides: number }>()?.sides).toBe(5);
    second.runtime.clearToolState();
    expect(first.runtime.getToolState()).toBeUndefined();
  });

  test('selection helpers manage selection set', () => {
    const selection: SelectionState = { ids: new Set<string>() };
    const { runtime } = createRuntime({ selectionState: selection });
    runtime.setSelection(['a', 'b']);
    expect(runtime.isSelected('a')).toBe(true);
    expect(selection.ids.has('b')).toBe(true);
    runtime.toggleSelection('b');
    expect(selection.ids.has('b')).toBe(false);
    runtime.toggleSelection('c');
    expect(selection.primaryId).toBe('c');
    runtime.clearSelection();
    expect(selection.ids.size).toBe(0);
  });
});
