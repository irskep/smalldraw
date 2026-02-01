import { describe, expect, test } from "bun:test";
import { Vec2 } from "gl-matrix";
import {
  type Box,
  BoxOperations,
  makePoint,
  type RectGeometry,
} from "@smalldraw/geometry";
import { createDocument } from "../../model/document";
import { getShapeBounds } from "../../model/geometryShapeUtils";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import type { PenShape } from "../../model/shapes/penShape";
import type { RectShape } from "../../model/shapes/rectShape";
import { UndoManager } from "../../undo";
import { ToolRuntimeImpl } from "../runtime";
import { createSelectionTool } from "../selection";
import type { HandleBehavior } from "../types";

// Union type for all shapes used in tests
type TestShape = RectShape | PenShape;

function setupDoc(shapes: TestShape[]) {
  const registry = getDefaultShapeHandlerRegistry();
  return { doc: createDocument(shapes, registry), registry };
}

describe("selection tool", () => {
  test("emits handle descriptors on activation", () => {
    const rectShape: RectShape = {
      id: "rect-handle",
      type: "rect",
      geometry: {
        type: "rect",
        size: makePoint(10, 10),
      },
      zIndex: "a",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(0, 0),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rectShape]);
    const undoManager = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
    });
    const tool = createSelectionTool();
    const payloads: unknown[] = [];
    runtime.onEvent("handles", (payload) => payloads.push(payload));
    const deactivate = tool.activate(runtime);
    expect(Array.isArray(payloads.at(-1))).toBe(true);
    deactivate?.();
    expect(payloads.at(-1)).toEqual([]);
  });

  test("hover events describe handle behavior with modifiers", () => {
    const rectShape: RectShape = {
      id: "rect-hover",
      type: "rect",
      geometry: {
        type: "rect",
        size: makePoint(10, 10),
      },
      zIndex: "a",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(0, 0),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rectShape]);
    const undoManager = new UndoManager();
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
    });
    const tool = createSelectionTool();
    const hovers: Array<{
      handleId: string | null;
      behavior: HandleBehavior | null;
    }> = [];
    runtime.onEvent(
      "handle-hover",
      (payload: { handleId: string | null; behavior: HandleBehavior | null }) =>
        hovers.push(payload),
    );
    tool.activate(runtime);

    runtime.dispatch("pointerMove", {
      point: makePoint(0, 0),
      buttons: 0,
      handleId: "top-left",
      shiftKey: true,
    });
    expect(hovers.at(-1)).toEqual({
      handleId: "top-left",
      behavior: { type: "resize", proportional: true },
    });

    runtime.dispatch("pointerMove", {
      point: makePoint(0, 0),
      buttons: 0,
      handleId: "top-left",
      altKey: true,
    });
    expect(hovers.at(-1)).toEqual({
      handleId: "top-left",
      behavior: { type: "rotate" },
    });
  });

  test("moves selected pen shape by dragging", () => {
    const penShape: PenShape = {
      id: "pen-1",
      type: "pen",
      geometry: {
        type: "pen",
        points: [makePoint(-5, -5), makePoint(5, 5)],
      },
      zIndex: "a",
      stroke: { type: "brush", color: "#000", size: 2 },
      interactions: { resizable: true, rotatable: false },
      transform: {
        translation: makePoint(5, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([penShape]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["pen-1"]),
      primaryId: "pen-1",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", { point: makePoint(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: makePoint(15, 5), buttons: 1 });
    runtime.dispatch("pointerUp", { point: makePoint(15, 5), buttons: 0 });

    const moved = document.shapes["pen-1"];
    expect(moved?.transform?.translation).toEqual(makePoint(20, 10));
  });

  test("moves all selected shapes when dragging", () => {
    const rect: RectShape = {
      id: "rect-move",
      type: "rect",
      geometry: { type: "rect", size: makePoint(10, 10) },
      zIndex: "b",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(15, 15),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const pen: PenShape = {
      id: "pen-move",
      type: "pen",
      geometry: {
        type: "pen",
        points: [makePoint(-5, -5), makePoint(5, 5)],
      },
      zIndex: "c",
      interactions: { resizable: true, rotatable: false },
      transform: {
        translation: makePoint(35, 10),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rect, pen]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["rect-move", "pen-move"]),
      primaryId: "rect-move",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", { point: makePoint(15, 15), buttons: 1 });
    runtime.dispatch("pointerMove", { point: makePoint(20, 20), buttons: 1 });
    runtime.dispatch("pointerUp", { point: makePoint(20, 20), buttons: 0 });

    expect(document.shapes["rect-move"]?.transform?.translation).toEqual(
      makePoint(20, 20),
    );
    expect(document.shapes["pen-move"]?.transform?.translation).toEqual(
      makePoint(40, 15),
    );
  });

  test("emits selection frame updates during move and resize", () => {
    const rect: RectShape = {
      id: "rect-frame",
      type: "rect",
      geometry: { type: "rect", size: makePoint(10, 10) },
      zIndex: "frame",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(5, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rect]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["rect-frame"]),
      primaryId: "rect-frame",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    const frames: Array<Box | null> = [];
    runtime.onEvent("selection-frame", (payload: Box | null) =>
      frames.push(payload),
    );
    tool.activate(runtime);

    runtime.dispatch("pointerDown", { point: makePoint(0, 0), buttons: 1 });
    runtime.dispatch("pointerMove", { point: makePoint(5, 5), buttons: 1 });
    runtime.dispatch("pointerUp", { point: makePoint(5, 5), buttons: 0 });

    expect(frames).toContainEqual({
      min: makePoint(5, 5),
      max: makePoint(15, 15),
    });

    frames.length = 0;

    runtime.dispatch("pointerDown", {
      point: makePoint(5, 5),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: makePoint(-5, -5),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: makePoint(-5, -5),
      buttons: 0,
      handleId: "top-left",
    });

    expect(frames).toContainEqual({
      min: makePoint(-5, -5),
      max: makePoint(15, 15),
    });
  });

  test("resizes rectangle using corner handle", () => {
    const rectShape: RectShape = {
      id: "rect-1",
      type: "rect",
      geometry: {
        type: "rect",
        size: makePoint(20, 10),
      },
      zIndex: "b",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(10, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rectShape]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["rect-1"]),
      primaryId: "rect-1",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", {
      point: makePoint(0, 0),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: makePoint(-10, -5),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: makePoint(-10, -5),
      buttons: 0,
      handleId: "top-left",
    });

    const resized = document.shapes["rect-1"] as RectShape | undefined;
    expect(resized?.geometry).toEqual({
      type: "rect",
      size: makePoint(30, 15),
    });
    expect(resized?.transform?.translation).toEqual(makePoint(5, 2.5));
  });

  test("resizes rotated rectangle around selection frame", () => {
    const rotatedRect: RectShape = {
      id: "rot-rect",
      type: "rect",
      geometry: { type: "rect", size: makePoint(20, 10) },
      zIndex: "rot",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(0, 0),
        rotation: Math.PI / 2,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rotatedRect]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["rot-rect"]),
      primaryId: "rot-rect",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", {
      point: makePoint(-5, -10),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: makePoint(-15, -20),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: makePoint(-15, -20),
      buttons: 0,
      handleId: "top-left",
    });

    const resized = document.shapes["rot-rect"] as RectShape | undefined;
    expect(resized?.transform?.translation).toEqual(makePoint(-5, -5));
    const geometry = resized?.geometry;
    expect(geometry?.type).toBe("rect");
    if (geometry?.type !== "rect") {
      throw new Error("Expected rectangle geometry");
    }
    const rectGeometry = geometry as RectGeometry;
    const initialBounds = getShapeBounds(rotatedRect, registry);
    const newBounds = BoxOperations.fromPointPair(
      initialBounds.max,
      makePoint(-15, -20),
    );
    const initialBoundsOps = new BoxOperations(initialBounds);
    const newBoundsOps = new BoxOperations(newBounds);
    const selectionScale = makePoint(
      newBoundsOps.width / initialBoundsOps.width,
      newBoundsOps.height / initialBoundsOps.height,
    );
    const startDiagonal = Math.hypot(
      initialBoundsOps.width,
      initialBoundsOps.height,
    );
    const endDiagonal = Math.hypot(
      initialBoundsOps.width * selectionScale.x,
      initialBoundsOps.height * selectionScale.y,
    );
    const uniformScale = startDiagonal === 0 ? 1 : endDiagonal / startDiagonal;
    expect(rectGeometry.size.x).toBeCloseTo(
      rotatedRect.geometry.size.x * uniformScale,
      6,
    );
    expect(rectGeometry.size.y).toBeCloseTo(
      rotatedRect.geometry.size.y * uniformScale,
      6,
    );
  });

  test("resizes rotated rectangle with world-axis scale", () => {
    const rotatedRect: RectShape = {
      id: "rot-rect-scale",
      type: "rect",
      geometry: { type: "rect", size: makePoint(24, 12) },
      zIndex: "rot-scale",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(0, 0),
        rotation: Math.PI / 3,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rotatedRect]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["rot-rect-scale"]),
      primaryId: "rot-rect-scale",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    const bounds = getShapeBounds(rotatedRect, registry);
    const targetSize = makePoint(new BoxOperations(bounds).size).mul([
      1.5, 0.75,
    ]);
    const opposite = bounds.max;
    const nextPoint = makePoint(opposite).sub(targetSize);

    runtime.dispatch("pointerDown", {
      point: bounds.min,
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: nextPoint,
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: nextPoint,
      buttons: 0,
      handleId: "top-left",
    });

    const resized = document.shapes["rot-rect-scale"] as RectShape | undefined;
    const geometry = resized?.geometry;
    expect(geometry?.type).toBe("rect");
    if (geometry?.type !== "rect") {
      throw new Error("Expected rectangle geometry");
    }
    const rectGeometry = geometry as RectGeometry;
    const boundsOps = new BoxOperations(bounds);
    const selectionScale = makePoint(
      targetSize.x / boundsOps.width,
      targetSize.y / boundsOps.height,
    );
    const startDiagonal = Math.hypot(boundsOps.width, boundsOps.height);
    const endDiagonal = Math.hypot(
      boundsOps.width * selectionScale.x,
      boundsOps.height * selectionScale.y,
    );
    const uniformScale = startDiagonal === 0 ? 1 : endDiagonal / startDiagonal;
    expect(rectGeometry.size.x).toBeCloseTo(
      rotatedRect.geometry.size.x * uniformScale,
      5,
    );
    expect(rectGeometry.size.y).toBeCloseTo(
      rotatedRect.geometry.size.y * uniformScale,
      5,
    );
  });

  test("resizes rotated rectangle along local width using axis handle", () => {
    const rotation = Math.PI / 4;
    const rectShape: RectShape = {
      id: "axis-rect",
      type: "rect",
      geometry: { type: "rect", size: makePoint(20, 10) },
      zIndex: "axis-rect",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(0, 0),
        rotation,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rectShape]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["axis-rect"]),
      primaryId: "axis-rect",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    const bounds = getShapeBounds(rectShape, registry);
    const startPoint = makePoint(
      bounds.max.x,
      (bounds.min.y + bounds.max.y) / 2,
    );
    const axisX = Vec2.rotate(makePoint(), makePoint(1, 0), [0, 0], rotation);
    const targetPoint = makePoint(
      startPoint.x + axisX.x * 10,
      startPoint.y + axisX.y * 10,
    );

    runtime.dispatch("pointerDown", {
      point: startPoint,
      buttons: 1,
      handleId: "mid-right",
    });
    runtime.dispatch("pointerMove", {
      point: targetPoint,
      buttons: 1,
      handleId: "mid-right",
    });
    runtime.dispatch("pointerUp", {
      point: targetPoint,
      buttons: 0,
      handleId: "mid-right",
    });

    const resized = document.shapes["axis-rect"] as RectShape | undefined;
    const geometry = resized?.geometry;
    expect(geometry?.type).toBe("rect");
    if (geometry?.type !== "rect") {
      throw new Error("Expected rectangle geometry");
    }
    const rectGeometry = geometry as RectGeometry;
    expect(rectGeometry.size.x).toBeCloseTo(30, 6);
    expect(rectGeometry.size.y).toBeCloseTo(10, 6);
    expect(resized?.transform?.translation.x).toBeCloseTo(axisX.x * 5, 6);
    expect(resized?.transform?.translation.y).toBeCloseTo(axisX.y * 5, 6);
  });

  test("axis resize keeps opposite edge fixed on unrotated rectangle", () => {
    const rectShape: RectShape = {
      id: "axis-rect-0",
      type: "rect",
      geometry: { type: "rect", size: makePoint(10, 10) },
      zIndex: "axis-rect-0",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(0, 0),
        rotation: 0,
        scale: makePoint(2, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rectShape]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["axis-rect-0"]),
      primaryId: "axis-rect-0",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", {
      point: makePoint(10, 0),
      buttons: 1,
      handleId: "mid-right",
    });
    runtime.dispatch("pointerMove", {
      point: makePoint(20, 0),
      buttons: 1,
      handleId: "mid-right",
    });
    runtime.dispatch("pointerUp", {
      point: makePoint(20, 0),
      buttons: 0,
      handleId: "mid-right",
    });

    const resized = document.shapes["axis-rect-0"];
    const bounds = resized ? getShapeBounds(resized, registry) : null;
    expect(bounds?.min.x).toBeCloseTo(-10, 6);
    expect(bounds?.max.x).toBeCloseTo(20, 6);
  });

  test("axis resize from left handle keeps right edge fixed", () => {
    const rectShape: RectShape = {
      id: "axis-rect-left",
      type: "rect",
      geometry: { type: "rect", size: makePoint(20, 10) },
      zIndex: "axis-rect-left",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(0, 0),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rectShape]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["axis-rect-left"]),
      primaryId: "axis-rect-left",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", {
      point: makePoint(-10, 0),
      buttons: 1,
      handleId: "mid-left",
    });
    runtime.dispatch("pointerMove", {
      point: makePoint(-20, 0),
      buttons: 1,
      handleId: "mid-left",
    });
    runtime.dispatch("pointerUp", {
      point: makePoint(-20, 0),
      buttons: 0,
      handleId: "mid-left",
    });

    const resized = document.shapes["axis-rect-left"];
    const bounds = resized ? getShapeBounds(resized, registry) : null;
    expect(bounds?.min.x).toBeCloseTo(-20, 6);
    expect(bounds?.max.x).toBeCloseTo(10, 6);
  });

  test("axis resize from top handle keeps bottom edge fixed", () => {
    const rectShape: RectShape = {
      id: "axis-rect-top",
      type: "rect",
      geometry: { type: "rect", size: makePoint(12, 10) },
      zIndex: "axis-rect-top",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(0, 0),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rectShape]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["axis-rect-top"]),
      primaryId: "axis-rect-top",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", {
      point: makePoint(0, -5),
      buttons: 1,
      handleId: "mid-top",
    });
    runtime.dispatch("pointerMove", {
      point: makePoint(0, -15),
      buttons: 1,
      handleId: "mid-top",
    });
    runtime.dispatch("pointerUp", {
      point: makePoint(0, -15),
      buttons: 0,
      handleId: "mid-top",
    });

    const resized = document.shapes["axis-rect-top"];
    const bounds = resized ? getShapeBounds(resized, registry) : null;
    expect(bounds?.min.y).toBeCloseTo(-15, 6);
    expect(bounds?.max.y).toBeCloseTo(5, 6);
  });

  test("non-resizable shapes keep relative position during resize", () => {
    const rect: RectShape = {
      id: "rect-relative",
      type: "rect",
      geometry: { type: "rect", size: makePoint(10, 10) },
      zIndex: "rect-relative",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(5, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const pen: PenShape = {
      id: "pen-relative",
      type: "pen",
      geometry: {
        type: "pen",
        points: [makePoint(-5, -5), makePoint(5, 5)],
      },
      zIndex: "pen-relative",
      interactions: { resizable: true, rotatable: false },
      transform: {
        translation: makePoint(5, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rect, pen]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["rect-relative", "pen-relative"]),
      primaryId: "rect-relative",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", {
      point: makePoint(0, 0),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: makePoint(-20, -10),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: makePoint(-20, -10),
      buttons: 0,
      handleId: "top-left",
    });

    expect(document.shapes["pen-relative"]?.transform?.translation).toEqual(
      makePoint(-5, 0),
    );
  });

  test("resizes pen stroke updates transform scale", () => {
    const penShape: PenShape = {
      id: "pen-scale",
      type: "pen",
      geometry: {
        type: "pen",
        points: [makePoint(-5, -5), makePoint(5, 5)],
      },
      zIndex: "pen-scale",
      interactions: { resizable: true, rotatable: false },
      transform: {
        translation: makePoint(10, 10),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([penShape]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["pen-scale"]),
      primaryId: "pen-scale",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", {
      point: makePoint(5, 5),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: makePoint(0, 0),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: makePoint(0, 0),
      buttons: 0,
      handleId: "top-left",
    });

    const resized = document.shapes["pen-scale"] as PenShape | undefined;
    expect(resized?.transform?.translation).toEqual(makePoint(7.5, 7.5));
    expect(resized?.transform?.scale).toEqual(makePoint(1.5, 1.5));
    expect(resized?.geometry).toEqual({
      type: "pen",
      points: [makePoint(-5, -5), makePoint(5, 5)],
    });
  });

  test("resizes multiple rectangles as a group", () => {
    const left: RectShape = {
      id: "left",
      type: "rect",
      geometry: { type: "rect", size: makePoint(10, 10) },
      zIndex: "l",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(5, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const right: RectShape = {
      id: "right",
      type: "rect",
      geometry: { type: "rect", size: makePoint(20, 10) },
      zIndex: "r",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(30, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([left, right]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["left", "right"]),
      primaryId: "left",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    runtime.dispatch("pointerDown", {
      point: makePoint(0, 0),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: makePoint(-20, -10),
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: makePoint(-20, -10),
      buttons: 0,
      handleId: "top-left",
    });

    expect(document.shapes.left?.transform?.translation).toEqual(
      makePoint(-12.5, 0),
    );
    expect((document.shapes.left as RectShape | undefined)?.geometry).toEqual({
      type: "rect",
      size: makePoint(15, 20),
    });
    expect(document.shapes.right?.transform?.translation).toEqual(
      makePoint(25, 0),
    );
    expect((document.shapes.right as RectShape | undefined)?.geometry).toEqual({
      type: "rect",
      size: makePoint(30, 20),
    });
  });

  test("rotates rectangle using rotation handle", () => {
    const rectShape: RectShape = {
      id: "rect-2",
      type: "rect",
      geometry: {
        type: "rect",
        size: makePoint(10, 10),
      },
      zIndex: "c",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(5, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rectShape]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["rect-2"]),
      primaryId: "rect-2",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    const startPoint = makePoint(5, -10);
    const endPoint = makePoint(15, 5);

    runtime.dispatch("pointerDown", {
      point: startPoint,
      buttons: 1,
      handleId: "rotate",
    });
    runtime.dispatch("pointerMove", {
      point: endPoint,
      buttons: 1,
      handleId: "rotate",
    });
    runtime.dispatch("pointerUp", {
      point: endPoint,
      buttons: 0,
      handleId: "rotate",
    });

    const rotated = document.shapes["rect-2"];
    expect(rotated?.transform?.rotation).toBeCloseTo(Math.PI / 2, 3);
  });

  test("rotates all selected rotatable shapes", () => {
    const left: RectShape = {
      id: "left-rot",
      type: "rect",
      geometry: { type: "rect", size: makePoint(10, 10) },
      zIndex: "x",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(5, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const right: RectShape = {
      id: "right-rot",
      type: "rect",
      geometry: { type: "rect", size: makePoint(10, 10) },
      zIndex: "y",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(25, 5),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([left, right]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["left-rot", "right-rot"]),
      primaryId: "left-rot",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });
    const tool = createSelectionTool();
    tool.activate(runtime);

    const startPoint = makePoint(5, -10);
    const endPoint = makePoint(15, 5);

    runtime.dispatch("pointerDown", {
      point: startPoint,
      buttons: 1,
      handleId: "rotate",
    });
    runtime.dispatch("pointerMove", {
      point: endPoint,
      buttons: 1,
      handleId: "rotate",
    });
    runtime.dispatch("pointerUp", {
      point: endPoint,
      buttons: 0,
      handleId: "rotate",
    });
    const center = makePoint(15, 5);
    const startVector = makePoint(startPoint).sub(center);
    const currentVector = makePoint(endPoint).sub(center);
    const targetVector =
      currentVector.x === 0 && currentVector.y === 0
        ? makePoint(1, 0)
        : currentVector;
    const expectedAngle = Vec2.angle(startVector, targetVector);
    const cross = Vec2.cross(new Float32Array(3), startVector, targetVector);
    const expectedDelta = expectedAngle * Math.sign(cross[2]);
    expect(document.shapes["left-rot"]?.transform?.rotation).toBeCloseTo(
      expectedDelta,
      3,
    );
    expect(document.shapes["right-rot"]?.transform?.rotation).toBeCloseTo(
      expectedDelta,
      3,
    );
  });

  test("clears selection frame when clicking outside selected shapes", () => {
    const rect1: RectShape = {
      id: "rect-1",
      type: "rect",
      geometry: { type: "rect", size: makePoint(50, 50) },
      zIndex: "a",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(100, 100),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const rect2: RectShape = {
      id: "rect-2",
      type: "rect",
      geometry: { type: "rect", size: makePoint(50, 50) },
      zIndex: "b",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(200, 100),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rect1, rect2]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["rect-1", "rect-2"]),
      primaryId: "rect-1",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });

    const tool = createSelectionTool();
    const frames: Array<Box | null> = [];
    runtime.onEvent("selection-frame", (payload: Box | null) =>
      frames.push(payload),
    );
    tool.activate(runtime);

    // Click at a point outside the selection bounding box
    // The selection bounding box spans from (75, 75) to (225, 125)
    // Click at (50, 50) which is outside
    runtime.dispatch("pointerDown", { point: makePoint(50, 50), buttons: 1 });

    // Should emit selection-frame with null to clear the visual frame
    expect(frames.at(-1)).toBe(null);
  });

  test("keeps selection frame when clicking inside multi-select bounding box", () => {
    const rect1: RectShape = {
      id: "rect-3",
      type: "rect",
      geometry: { type: "rect", size: makePoint(50, 50) },
      zIndex: "a",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(100, 100),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const rect2: RectShape = {
      id: "rect-4",
      type: "rect",
      geometry: { type: "rect", size: makePoint(50, 50) },
      zIndex: "b",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: makePoint(200, 100),
        rotation: 0,
        scale: makePoint(1, 1),
      },
    };
    const { doc: document, registry } = setupDoc([rect1, rect2]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["rect-3", "rect-4"]),
      primaryId: "rect-3",
    };
    const runtime = new ToolRuntimeImpl({
      toolId: "selection",
      document,
      undoManager,
      shapeHandlers: registry,
      selectionState,
    });

    const tool = createSelectionTool();
    const frames: Array<Box | null> = [];
    runtime.onEvent("selection-frame", (payload: Box | null) =>
      frames.push(payload),
    );
    tool.activate(runtime);

    // Click at a point inside the bounding box but not on a shape
    // The selection bounding box spans from (75, 75) to (225, 125)
    // Click at (150, 100) which is inside the box but between the two rectangles
    const initialFrameCount = frames.length;
    runtime.dispatch("pointerDown", { point: makePoint(150, 100), buttons: 1 });

    // Should start a drag operation, not clear the selection
    // The selection frame should be updated but not cleared (not null)
    const lastFrame = frames.at(-1);
    expect(lastFrame).not.toBe(null);
    expect(frames.length).toBeGreaterThan(initialFrameCount);
  });
});
