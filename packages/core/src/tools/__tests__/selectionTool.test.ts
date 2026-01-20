import { describe, expect, test } from "bun:test";

import { createDocument } from "../../model/document";
import type { EllipseGeometry, RectGeometry } from "../../model/geometry";
import { getShapeBounds } from "../../model/geometryBounds";
import type { Bounds } from "../../model/primitives";
import type { Shape } from "../../model/shape";
import { getDefaultShapeHandlerRegistry } from "../../model/shapeHandlers";
import { UndoManager } from "../../undo";
import { ToolRuntimeImpl } from "../runtime";
import { createSelectionTool } from "../selection";
import type { HandleBehavior } from "../types";

function setupDoc(shapes: Shape[]) {
  const registry = getDefaultShapeHandlerRegistry();
  return { doc: createDocument(shapes, registry), registry };
}

describe("selection tool", () => {
  test("emits handle descriptors on activation", () => {
    const rectShape: Shape = {
      id: "rect-handle",
      geometry: {
        type: "rect",
        size: { width: 10, height: 10 },
      },
      zIndex: "a",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
    const rectShape: Shape = {
      id: "rect-hover",
      geometry: {
        type: "rect",
        size: { width: 10, height: 10 },
      },
      zIndex: "a",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
      point: { x: 0, y: 0 },
      buttons: 0,
      handleId: "top-left",
      shiftKey: true,
    });
    expect(hovers.at(-1)).toEqual({
      handleId: "top-left",
      behavior: { type: "resize", proportional: true },
    });

    runtime.dispatch("pointerMove", {
      point: { x: 0, y: 0 },
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
    const penShape: Shape = {
      id: "pen-1",
      geometry: {
        type: "pen",
        points: [
          { x: -5, y: -5 },
          { x: 5, y: 5 },
        ],
      },
      zIndex: "a",
      stroke: { type: "brush", color: "#000", size: 2 },
      interactions: { resizable: true, rotatable: false },
      transform: {
        translation: { x: 5, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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

    runtime.dispatch("pointerDown", { point: { x: 0, y: 0 }, buttons: 1 });
    runtime.dispatch("pointerMove", { point: { x: 15, y: 5 }, buttons: 1 });
    runtime.dispatch("pointerUp", { point: { x: 15, y: 5 }, buttons: 0 });

    const moved = document.shapes["pen-1"];
    expect(moved?.transform?.translation).toEqual({ x: 20, y: 10 });
  });

  test("moves all selected shapes when dragging", () => {
    const rect: Shape = {
      id: "rect-move",
      geometry: { type: "rect", size: { width: 10, height: 10 } },
      zIndex: "b",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 15, y: 15 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
    };
    const pen: Shape = {
      id: "pen-move",
      geometry: {
        type: "pen",
        points: [
          { x: -5, y: -5 },
          { x: 5, y: 5 },
        ],
      },
      zIndex: "c",
      interactions: { resizable: true, rotatable: false },
      transform: {
        translation: { x: 35, y: 10 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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

    runtime.dispatch("pointerDown", { point: { x: 15, y: 15 }, buttons: 1 });
    runtime.dispatch("pointerMove", { point: { x: 20, y: 20 }, buttons: 1 });
    runtime.dispatch("pointerUp", { point: { x: 20, y: 20 }, buttons: 0 });

    expect(document.shapes["rect-move"]?.transform?.translation).toEqual({
      x: 20,
      y: 20,
    });
    expect(document.shapes["pen-move"]?.transform?.translation).toEqual({
      x: 40,
      y: 15,
    });
  });

  test("emits selection frame updates during move and resize", () => {
    const rect: Shape = {
      id: "rect-frame",
      geometry: { type: "rect", size: { width: 10, height: 10 } },
      zIndex: "frame",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 5, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
    const frames: Array<Bounds | null> = [];
    runtime.onEvent("selection-frame", (payload: Bounds | null) =>
      frames.push(payload),
    );
    tool.activate(runtime);

    runtime.dispatch("pointerDown", { point: { x: 0, y: 0 }, buttons: 1 });
    runtime.dispatch("pointerMove", { point: { x: 5, y: 5 }, buttons: 1 });
    runtime.dispatch("pointerUp", { point: { x: 5, y: 5 }, buttons: 0 });

    expect(frames).toContainEqual({
      minX: 5,
      minY: 5,
      maxX: 15,
      maxY: 15,
      width: 10,
      height: 10,
    });

    frames.length = 0;

    runtime.dispatch("pointerDown", {
      point: { x: 5, y: 5 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: { x: -5, y: -5 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: { x: -5, y: -5 },
      buttons: 0,
      handleId: "top-left",
    });

    expect(frames).toContainEqual({
      minX: -5,
      minY: -5,
      maxX: 15,
      maxY: 15,
      width: 20,
      height: 20,
    });
  });

  test("resizes rectangle using corner handle", () => {
    const rectShape: Shape = {
      id: "rect-1",
      geometry: {
        type: "rect",
        size: { width: 20, height: 10 },
      },
      zIndex: "b",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 10, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
      point: { x: 0, y: 0 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: { x: -10, y: -5 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: { x: -10, y: -5 },
      buttons: 0,
      handleId: "top-left",
    });

    const resized = document.shapes["rect-1"];
    expect(resized?.geometry).toEqual({
      type: "rect",
      size: { width: 30, height: 15 },
    });
    expect(resized?.transform?.translation).toEqual({ x: 5, y: 2.5 });
  });

  test("resizes rotated rectangle around selection frame", () => {
    const rotatedRect: Shape = {
      id: "rot-rect",
      geometry: { type: "rect", size: { width: 20, height: 10 } },
      zIndex: "rot",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: Math.PI / 2,
        scale: { x: 1, y: 1 },
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
      point: { x: -5, y: -10 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: { x: -15, y: -20 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: { x: -15, y: -20 },
      buttons: 0,
      handleId: "top-left",
    });

    const resized = document.shapes["rot-rect"];
    expect(resized?.transform?.translation).toEqual({ x: -5, y: -5 });
    const geometry = resized?.geometry;
    expect(geometry?.type).toBe("rect");
    if (geometry?.type !== "rect") {
      throw new Error("Expected rectangle geometry");
    }
    const rectGeometry = geometry as RectGeometry;
    expect(rectGeometry.size.width).toBeCloseTo(30, 6);
    expect(rectGeometry.size.height).toBeCloseTo(20, 6);
  });

  test("resizes rotated rectangle with world-axis scale", () => {
    const rotatedRect: Shape = {
      id: "rot-rect-scale",
      geometry: { type: "rect", size: { width: 24, height: 12 } },
      zIndex: "rot-scale",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: Math.PI / 3,
        scale: { x: 1, y: 1 },
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
    const targetWidth = bounds.width * 1.5;
    const targetHeight = bounds.height * 0.75;
    const opposite = { x: bounds.maxX, y: bounds.maxY };
    const nextPoint = {
      x: opposite.x - targetWidth,
      y: opposite.y - targetHeight,
    };

    runtime.dispatch("pointerDown", {
      point: { x: bounds.minX, y: bounds.minY },
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

    const resized = document.shapes["rot-rect-scale"];
    const geometry = resized?.geometry;
    expect(geometry?.type).toBe("rect");
    if (geometry?.type !== "rect") {
      throw new Error("Expected rectangle geometry");
    }
    const rectGeometry = geometry as RectGeometry;
    const cos = Math.abs(Math.cos(rotatedRect.transform?.rotation ?? 0));
    const sin = Math.abs(Math.sin(rotatedRect.transform?.rotation ?? 0));
    const det = cos * cos - sin * sin;
    const expectedWidth = (cos * targetWidth - sin * targetHeight) / det;
    const expectedHeight = (cos * targetHeight - sin * targetWidth) / det;
    expect(rectGeometry.size.width).toBeCloseTo(expectedWidth, 6);
    expect(rectGeometry.size.height).toBeCloseTo(expectedHeight, 6);
  });

  test("resizes rotated rectangle along local width using axis handle", () => {
    const rotation = Math.PI / 4;
    const rectShape: Shape = {
      id: "axis-rect",
      geometry: { type: "rect", size: { width: 20, height: 10 } },
      zIndex: "axis-rect",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation,
        scale: { x: 1, y: 1 },
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
    const startPoint = { x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2 };
    const axisX = { x: Math.cos(rotation), y: Math.sin(rotation) };
    const targetPoint = {
      x: startPoint.x + axisX.x * 10,
      y: startPoint.y + axisX.y * 10,
    };

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

    const resized = document.shapes["axis-rect"];
    const geometry = resized?.geometry;
    expect(geometry?.type).toBe("rect");
    if (geometry?.type !== "rect") {
      throw new Error("Expected rectangle geometry");
    }
    const rectGeometry = geometry as RectGeometry;
    expect(rectGeometry.size.width).toBeCloseTo(30, 6);
    expect(rectGeometry.size.height).toBeCloseTo(10, 6);
    expect(resized?.transform?.translation.x).toBeCloseTo(axisX.x * 5, 6);
    expect(resized?.transform?.translation.y).toBeCloseTo(axisX.y * 5, 6);
  });

  test("axis resize keeps opposite edge fixed on unrotated rectangle", () => {
    const rectShape: Shape = {
      id: "axis-rect-0",
      geometry: { type: "rect", size: { width: 10, height: 10 } },
      zIndex: "axis-rect-0",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 2, y: 1 },
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
      point: { x: 10, y: 0 },
      buttons: 1,
      handleId: "mid-right",
    });
    runtime.dispatch("pointerMove", {
      point: { x: 20, y: 0 },
      buttons: 1,
      handleId: "mid-right",
    });
    runtime.dispatch("pointerUp", {
      point: { x: 20, y: 0 },
      buttons: 0,
      handleId: "mid-right",
    });

    const resized = document.shapes["axis-rect-0"];
    const bounds = resized ? getShapeBounds(resized, registry) : null;
    expect(bounds?.minX).toBeCloseTo(-10, 6);
    expect(bounds?.maxX).toBeCloseTo(20, 6);
  });

  test("axis resize from left handle keeps right edge fixed", () => {
    const rectShape: Shape = {
      id: "axis-rect-left",
      geometry: { type: "rect", size: { width: 20, height: 10 } },
      zIndex: "axis-rect-left",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
      point: { x: -10, y: 0 },
      buttons: 1,
      handleId: "mid-left",
    });
    runtime.dispatch("pointerMove", {
      point: { x: -20, y: 0 },
      buttons: 1,
      handleId: "mid-left",
    });
    runtime.dispatch("pointerUp", {
      point: { x: -20, y: 0 },
      buttons: 0,
      handleId: "mid-left",
    });

    const resized = document.shapes["axis-rect-left"];
    const bounds = resized ? getShapeBounds(resized, registry) : null;
    expect(bounds?.minX).toBeCloseTo(-20, 6);
    expect(bounds?.maxX).toBeCloseTo(10, 6);
  });

  test("axis resize from top handle keeps bottom edge fixed", () => {
    const rectShape: Shape = {
      id: "axis-rect-top",
      geometry: { type: "rect", size: { width: 12, height: 10 } },
      zIndex: "axis-rect-top",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
      point: { x: 0, y: -5 },
      buttons: 1,
      handleId: "mid-top",
    });
    runtime.dispatch("pointerMove", {
      point: { x: 0, y: -15 },
      buttons: 1,
      handleId: "mid-top",
    });
    runtime.dispatch("pointerUp", {
      point: { x: 0, y: -15 },
      buttons: 0,
      handleId: "mid-top",
    });

    const resized = document.shapes["axis-rect-top"];
    const bounds = resized ? getShapeBounds(resized, registry) : null;
    expect(bounds?.minY).toBeCloseTo(-15, 6);
    expect(bounds?.maxY).toBeCloseTo(5, 6);
  });

  test("non-resizable shapes keep relative position during resize", () => {
    const rect: Shape = {
      id: "rect-relative",
      geometry: { type: "rect", size: { width: 10, height: 10 } },
      zIndex: "rect-relative",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 5, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
    };
    const pen: Shape = {
      id: "pen-relative",
      geometry: {
        type: "pen",
        points: [
          { x: -5, y: -5 },
          { x: 5, y: 5 },
        ],
      },
      zIndex: "pen-relative",
      interactions: { resizable: true, rotatable: false },
      transform: {
        translation: { x: 5, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
      point: { x: 0, y: 0 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: { x: -20, y: -10 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: { x: -20, y: -10 },
      buttons: 0,
      handleId: "top-left",
    });

    expect(document.shapes["pen-relative"]?.transform?.translation).toEqual({
      x: -5,
      y: 0,
    });
  });

  test("resizes ellipse geometry using handles", () => {
    const ellipse: Shape = {
      id: "ellipse",
      geometry: { type: "ellipse", radiusX: 20, radiusY: 10 },
      zIndex: "ell",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
    };
    const { doc: document, registry } = setupDoc([ellipse]);
    const undoManager = new UndoManager();
    const selectionState = {
      ids: new Set<string>(["ellipse"]),
      primaryId: "ellipse",
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
      point: { x: -20, y: -10 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: { x: -40, y: -20 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: { x: -40, y: -20 },
      buttons: 0,
      handleId: "top-left",
    });

    const resized = document.shapes.ellipse;
    const geometry = resized?.geometry;
    expect(geometry?.type).toBe("ellipse");
    if (geometry?.type !== "ellipse") {
      throw new Error("Expected ellipse geometry");
    }
    const ellipseGeometry = geometry as EllipseGeometry;
    expect(ellipseGeometry.radiusX).toBeCloseTo(30, 6);
    expect(ellipseGeometry.radiusY).toBeCloseTo(15, 6);
    expect(resized?.transform?.translation).toEqual({ x: -10, y: -5 });
  });

  test("resizes pen stroke updates transform scale", () => {
    const penShape: Shape = {
      id: "pen-scale",
      geometry: {
        type: "pen",
        points: [
          { x: -5, y: -5 },
          { x: 5, y: 5 },
        ],
      },
      zIndex: "pen-scale",
      interactions: { resizable: true, rotatable: false },
      transform: {
        translation: { x: 10, y: 10 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
      point: { x: 5, y: 5 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: { x: 0, y: 0 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: { x: 0, y: 0 },
      buttons: 0,
      handleId: "top-left",
    });

    const resized = document.shapes["pen-scale"];
    expect(resized?.transform?.translation).toEqual({ x: 7.5, y: 7.5 });
    expect(resized?.transform?.scale).toEqual({ x: 1.5, y: 1.5 });
    expect(resized?.geometry).toEqual({
      type: "pen",
      points: [
        { x: -5, y: -5 },
        { x: 5, y: 5 },
      ],
    });
  });

  test("resizes multiple rectangles as a group", () => {
    const left: Shape = {
      id: "left",
      geometry: { type: "rect", size: { width: 10, height: 10 } },
      zIndex: "l",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 5, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
    };
    const right: Shape = {
      id: "right",
      geometry: { type: "rect", size: { width: 20, height: 10 } },
      zIndex: "r",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 30, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
      point: { x: 0, y: 0 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerMove", {
      point: { x: -20, y: -10 },
      buttons: 1,
      handleId: "top-left",
    });
    runtime.dispatch("pointerUp", {
      point: { x: -20, y: -10 },
      buttons: 0,
      handleId: "top-left",
    });

    expect(document.shapes.left?.transform?.translation).toEqual({
      x: -12.5,
      y: 0,
    });
    expect(document.shapes.left?.geometry).toEqual({
      type: "rect",
      size: { width: 15, height: 20 },
    });
    expect(document.shapes.right?.transform?.translation).toEqual({
      x: 25,
      y: 0,
    });
    expect(document.shapes.right?.geometry).toEqual({
      type: "rect",
      size: { width: 30, height: 20 },
    });
  });

  test("rotates rectangle using rotation handle", () => {
    const rectShape: Shape = {
      id: "rect-2",
      geometry: {
        type: "rect",
        size: { width: 10, height: 10 },
      },
      zIndex: "c",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 5, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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

    const startPoint = { x: 5, y: -10 };
    const endPoint = { x: 15, y: 5 };

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
    const left: Shape = {
      id: "left-rot",
      geometry: { type: "rect", size: { width: 10, height: 10 } },
      zIndex: "x",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 5, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
    };
    const right: Shape = {
      id: "right-rot",
      geometry: { type: "rect", size: { width: 10, height: 10 } },
      zIndex: "y",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 25, y: 5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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

    const startPoint = { x: 5, y: -10 };
    const endPoint = { x: 15, y: 5 };

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
    const center = { x: 15, y: 5 };
    const expectedDelta =
      Math.atan2(endPoint.y - center.y, endPoint.x - center.x) -
      Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
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
    const rect1: Shape = {
      id: "rect-1",
      geometry: { type: "rect", size: { width: 50, height: 50 } },
      zIndex: "a",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 100, y: 100 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
    };
    const rect2: Shape = {
      id: "rect-2",
      geometry: { type: "rect", size: { width: 50, height: 50 } },
      zIndex: "b",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 200, y: 100 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
    const frames: Array<Bounds | null> = [];
    runtime.onEvent("selection-frame", (payload: Bounds | null) =>
      frames.push(payload),
    );
    tool.activate(runtime);

    // Click at a point outside the selection bounding box
    // The selection bounding box spans from (75, 75) to (225, 125)
    // Click at (50, 50) which is outside
    runtime.dispatch("pointerDown", { point: { x: 50, y: 50 }, buttons: 1 });

    // Should emit selection-frame with null to clear the visual frame
    expect(frames.at(-1)).toBe(null);
  });

  test("keeps selection frame when clicking inside multi-select bounding box", () => {
    const rect1: Shape = {
      id: "rect-3",
      geometry: { type: "rect", size: { width: 50, height: 50 } },
      zIndex: "a",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 100, y: 100 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
    };
    const rect2: Shape = {
      id: "rect-4",
      geometry: { type: "rect", size: { width: 50, height: 50 } },
      zIndex: "b",
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 200, y: 100 },
        rotation: 0,
        scale: { x: 1, y: 1 },
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
    const frames: Array<Bounds | null> = [];
    runtime.onEvent("selection-frame", (payload: Bounds | null) =>
      frames.push(payload),
    );
    tool.activate(runtime);

    // Click at a point inside the bounding box but not on a shape
    // The selection bounding box spans from (75, 75) to (225, 125)
    // Click at (150, 100) which is inside the box but between the two rectangles
    const initialFrameCount = frames.length;
    runtime.dispatch("pointerDown", { point: { x: 150, y: 100 }, buttons: 1 });

    // Should start a drag operation, not clear the selection
    // The selection frame should be updated but not cleared (not null)
    const lastFrame = frames.at(-1);
    expect(lastFrame).not.toBe(null);
    expect(frames.length).toBeGreaterThan(initialFrameCount);
  });
});
