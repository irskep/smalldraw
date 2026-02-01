import { describe, expect, test } from "bun:test";
import { BoxOperations } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { getShapeBounds } from "../geometryShapeUtils";
import { getDefaultShapeHandlerRegistry } from "../shapeHandlers";
import type { PenShape } from "../shapes/penShape";
import type { RectShape } from "../shapes/rectShape";

describe("geometry bounds helpers", () => {
  test("computes bounds for rotated rectangle using center-based transform", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: RectShape = {
      id: "rect",
      type: "rect",
      geometry: { type: "rect", size: new Vec2(20, 10) },
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: new Vec2(),
        rotation: Math.PI / 2,
        scale: new Vec2(1),
      },
      zIndex: "rect",
    };
    const bounds = getShapeBounds(shape, registry);
    expect(bounds.min.x).toBeCloseTo(-5);
    expect(bounds.max.x).toBeCloseTo(5);
    expect(bounds.min.y).toBeCloseTo(-10);
    expect(bounds.max.y).toBeCloseTo(10);
    expect(new BoxOperations(bounds).width).toBeCloseTo(10);
    expect(new BoxOperations(bounds).height).toBeCloseTo(20);
  });

  test("derives bounds from pen geometry points and translation", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: PenShape = {
      id: "pen",
      type: "pen",
      geometry: {
        type: "pen",
        points: [new Vec2(-2, -1), new Vec2(3, 4)],
      },
      transform: {
        translation: new Vec2(5, -5),
        rotation: 0,
        scale: new Vec2(1),
      },
      zIndex: "pen",
    };
    const bounds = getShapeBounds(shape, registry);
    expect(bounds.min.x).toBeCloseTo(3);
    expect(bounds.max.x).toBeCloseTo(8);
    expect(bounds.min.y).toBeCloseTo(-6);
    expect(bounds.max.y).toBeCloseTo(-1);
  });

  test("includes stroke width in computed bounds", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: RectShape = {
      id: "stroked",
      type: "rect",
      geometry: { type: "rect", size: new Vec2(10) },
      stroke: { type: "brush", color: "#000", size: 4 },
      transform: {
        translation: new Vec2(),
        rotation: 0,
        scale: new Vec2(1),
      },
      zIndex: "stroked",
    };
    const bounds = getShapeBounds(shape, registry);
    expect(bounds.min.x).toBe(-5 - 2);
    expect(bounds.max.x).toBe(5 + 2);
    expect(bounds.min.y).toBe(-5 - 2);
    expect(bounds.max.y).toBe(5 + 2);
  });
});
