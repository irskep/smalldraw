import { describe, expect, test } from "bun:test";

import type { AnyGeometry, Bounds } from "@smalldraw/geometry";
import type { Shape } from "../../model/shape";
import { ShapeHandlerRegistry } from "../../model/shapeHandlers";
import { resolveSelectionHandlePoint } from "../selectionHandles";
import type { HandleDescriptor } from "../types";

const selectionBounds: Bounds = {
  minX: 0,
  minY: 0,
  maxX: 200,
  maxY: 100,
  width: 200,
  height: 100,
};

const midRightHandle: HandleDescriptor = {
  id: "mid-right",
  position: { u: 1, v: 0.5 },
  behavior: { type: "resize-axis", axis: "x" },
};

describe("resolveSelectionHandlePoint", () => {
  test("uses shape handler override when provided", () => {
    const registry = new ShapeHandlerRegistry();
    registry.register("custom", {
      geometry: {
        getBounds: () => ({
          minX: -10,
          minY: -5,
          maxX: 10,
          maxY: 5,
          width: 20,
          height: 10,
        }),
      },
      selection: {
        getAxisHandlePoint: () => ({ x: 123, y: 456 }),
      },
    });

    const shape: Shape & { geometry: AnyGeometry } = {
      id: "shape-1",
      type: "custom",
      geometry: { type: "custom" },
      zIndex: "z",
      transform: {
        translation: { x: 100, y: 100 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
    };

    const point = resolveSelectionHandlePoint(
      selectionBounds,
      midRightHandle,
      shape,
      registry,
    );
    expect(point).toEqual({ x: 123, y: 456 });
  });

  test("falls back to geometry local bounds when no override", () => {
    const registry = new ShapeHandlerRegistry();
    registry.register("custom", {
      geometry: {
        getBounds: () => ({
          minX: -10,
          minY: -5,
          maxX: 10,
          maxY: 5,
          width: 20,
          height: 10,
        }),
      },
    });

    const shape: Shape & { geometry: AnyGeometry } = {
      id: "shape-2",
      type: "custom",
      geometry: { type: "custom" },
      zIndex: "z",
      transform: {
        translation: { x: 100, y: 100 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
    };

    const point = resolveSelectionHandlePoint(
      selectionBounds,
      midRightHandle,
      shape,
      registry,
    );
    expect(point).toEqual({ x: 110, y: 100 });
  });
});
