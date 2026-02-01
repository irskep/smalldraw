import { describe, expect, test } from "bun:test";
import type { PenGeometry } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { AddShape } from "../../actions";
import { createDocument } from "../../model/document";
import type { DrawingDocumentData } from "../../model/document";
import { canonicalizeShape } from "../../model/shape";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { RectShape } from "../../model/shapes/rectShape";
import { UndoManager } from "../../undo";
import { getZIndexBetween } from "../../zindex";
import { ToolRuntimeImpl } from "../runtime";
import type { SelectionState, SharedToolSettings } from "../types";
import { change } from "@automerge/automerge";

interface RuntimeOverrides {
  options?: Record<string, unknown>;
  sharedSettings?: SharedToolSettings;
  selectionState?: SelectionState;
  toolStates?: Map<string, unknown>;
}

function createRuntime(overrides?: RuntimeOverrides) {
  const registry = getDefaultShapeHandlerRegistry();
  let document = createDocument(undefined, registry);
  const undoManager = new UndoManager();
  const draftChanges: Array<unknown> = [];
  const ctx = {
    registry,
    change: (
      next: typeof document,
      update: (draft: DrawingDocumentData) => void,
    ) => change(next, update),
  };
  const runtime = new ToolRuntimeImpl({
    toolId: "pen",
    getDocument: () => document,
    commitAction: (action) => {
      document = undoManager.apply(action, document, ctx);
    },
    shapeHandlers: registry,
    options: overrides?.options,
    onDraftChange: (draft) => draftChanges.push(draft),
    sharedSettings: overrides?.sharedSettings,
    selectionState: overrides?.selectionState,
    toolStates: overrides?.toolStates,
  });
  return { runtime, getDocument: () => document, undoManager, draftChanges };
}

describe("ToolRuntimeImpl", () => {
  const v = (x = 0, y = x): [number, number] => [x, y];
  test("registers event handlers and disposers", () => {
    const { runtime } = createRuntime();
    let count = 0;
    const disposer = runtime.on("pointerDown", () => {
      count += 1;
    });

    runtime.dispatch("pointerDown", { point: new Vec2(0, 0), buttons: 1 });
    expect(count).toBe(1);

    disposer();
    runtime.dispatch("pointerDown", { point: new Vec2(1, 1), buttons: 1 });
    expect(count).toBe(1);
  });

  test("setDraft stores draft and clearDraft resets it", () => {
    const { runtime, draftChanges } = createRuntime();
    const geometry: PenGeometry = { type: "pen", points: [v(0, 0)] };
    runtime.setDraft({
      toolId: "pen",
      temporary: true,
      id: "draft-1",
      type: "pen",
      geometry,
      zIndex: "a",
    });
    expect(runtime.getDraft()?.id).toBe("draft-1");
    runtime.clearDraft();
    expect(runtime.getDraft()).toBeNull();
    expect(draftChanges[draftChanges.length - 1]).toEqual([]);
  });

  test("commit applies undoable action to the document", () => {
    const { runtime, getDocument } = createRuntime();
    const registry = getDefaultShapeHandlerRegistry();
    const shape: RectShape = {
      id: "rect-1",
      type: "rect",
      geometry: {
        type: "rect",
        size: [10, 10],
      },
      zIndex: "a",
      transform: {
        translation: [0, 0],
        scale: [1, 1],
        rotation: 0,
      },
    };

    runtime.commit(new AddShape(shape));
    expect(getDocument().shapes[shape.id]).toEqual(
      canonicalizeShape(shape, registry),
    );
  });

  test("getNextZIndex generates keys after top shape", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const zIndex = getZIndexBetween(null, null);
    let document = createDocument(
      [
        {
          id: "shape-1",
          type: "rect",
          geometry: {
            type: "rect",
            size: [10, 10],
          },
          zIndex,
          transform: {
            translation: [0, 0],
            scale: [1, 1],
            rotation: 0,
          },
        } as RectShape,
      ],
      registry,
    );
    const undoManager = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: "pen",
      getDocument: () => document,
      commitAction: (action) => {
        document = undoManager.apply(action, document, {
          registry,
          change: (next, update) => change(next, update),
        });
      },
      shapeHandlers: registry,
    });
    const next = runtime.getNextZIndex();
    expect(next).not.toBe(zIndex);
  });

  test("returns tool options through getOptions", () => {
    const { runtime } = createRuntime({
      options: { stroke: { type: "brush", color: "#f00", size: 3 } },
    });
    const options = runtime.getOptions<{ stroke: { color: string } }>();
    expect(options?.stroke.color).toBe("#f00");
  });

  test("shared settings can be read and updated", () => {
    const shared: SharedToolSettings = {
      strokeColor: "#0000ff",
      strokeWidth: 3,
      fillColor: "#cccccc",
    };
    const { runtime } = createRuntime({ sharedSettings: shared });
    expect(runtime.getSharedSettings().strokeColor).toBe("#0000ff");
    runtime.updateSharedSettings({ strokeWidth: 8 });
    expect(shared.strokeWidth).toBe(8);
    expect(runtime.getSharedSettings().strokeWidth).toBe(8);
  });

  test("tool state persists via shared map between runtimes", () => {
    const toolStates = new Map<string, unknown>();
    const first = createRuntime({ toolStates });
    first.runtime.setToolState({ sides: 5 });
    const second = createRuntime({ toolStates });
    expect(second.runtime.getToolState<{ sides: number }>()?.sides).toBe(5);
    second.runtime.clearToolState();
    expect(first.runtime.getToolState()).toBeUndefined();
  });

  test("selection helpers manage selection set", () => {
    const selection: SelectionState = { ids: new Set<string>() };
    const { runtime } = createRuntime({ selectionState: selection });
    runtime.setSelection(["a", "b"]);
    expect(runtime.isSelected("a")).toBe(true);
    expect(selection.ids.has("b")).toBe(true);
    runtime.toggleSelection("b");
    expect(selection.ids.has("b")).toBe(false);
    runtime.toggleSelection("c");
    expect(selection.primaryId).toBe("c");
    runtime.clearSelection();
    expect(selection.ids.size).toBe(0);
  });
});
