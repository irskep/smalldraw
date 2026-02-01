import { describe, expect, test } from "bun:test";
import type { AnyGeometry, Box } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import type { Shape } from "../../model/shape";
import { ShapeHandlerRegistry } from "../../model/shapeHandlers";
import { resolveSelectionHandlePoint } from "../selectionHandles";
import type { HandleDescriptor } from "../types";

const selectionBounds: Box = { min: new Vec2(0), max: new Vec2(200, 100) };

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
        getBounds: () => ({ min: new Vec2(-10, -5), max: new Vec2(10, 5) }),
      },
      selection: {
        getAxisHandlePoint: () => new Vec2(123, 456),
      },
    });

    const shape: Shape & { geometry: AnyGeometry } = {
      id: "shape-1",
      type: "custom",
      geometry: { type: "custom" },
      zIndex: "z",
      transform: {
        translation: new Vec2(100, 100),
        rotation: 0,
        scale: new Vec2(1, 1),
      },
    };

    const point = resolveSelectionHandlePoint(
      selectionBounds,
      midRightHandle,
      shape,
      registry,
    );
    expect(point).toEqual(new Vec2(123, 456));
  });

  test("falls back to geometry local bounds when no override", () => {
    const registry = new ShapeHandlerRegistry();
    registry.register("custom", {
      geometry: {
        getBounds: () => ({ min: new Vec2(-10, -5), max: new Vec2(10, 5) }),
      },
    });

    const shape: Shape & { geometry: AnyGeometry } = {
      id: "shape-2",
      type: "custom",
      geometry: { type: "custom" },
      zIndex: "z",
      transform: {
        translation: new Vec2(100, 100),
        rotation: 0,
        scale: new Vec2(1, 1),
      },
    };

    const point = resolveSelectionHandlePoint(
      selectionBounds,
      midRightHandle,
      shape,
      registry,
    );
    expect(point).toEqual(new Vec2(110, 100));
  });
});
