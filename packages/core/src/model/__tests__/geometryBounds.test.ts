import { describe, expect, test } from "bun:test";
import { BoxOperations, getX, getY } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { getShapeBounds } from "../geometryShapeUtils";
import { getDefaultShapeHandlerRegistry } from "../shapeHandlers";
import type { PenShape } from "../shapes/penShape";
import type { RectShape } from "../shapes/rectShape";

describe("geometry bounds helpers", () => {
  const v = (x = 0, y = x): [number, number] => [x, y];
  test("computes bounds for rotated rectangle using center-based transform", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: RectShape = {
      id: "rect",
      type: "rect",
      geometry: { type: "rect", size: v(20, 10) },
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: v(0, 0),
        rotation: Math.PI / 2,
        scale: v(1, 1),
      },
      zIndex: "rect",
    };
    const bounds = getShapeBounds(shape, registry);
    expect(getX(bounds.min)).toBeCloseTo(-5);
    expect(getX(bounds.max)).toBeCloseTo(5);
    expect(getY(bounds.min)).toBeCloseTo(-10);
    expect(getY(bounds.max)).toBeCloseTo(10);
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
        points: [v(-2, -1), v(3, 4)],
      },
      transform: {
        translation: v(5, -5),
        rotation: 0,
        scale: v(1, 1),
      },
      zIndex: "pen",
    };
    const bounds = getShapeBounds(shape, registry);
    expect(getX(bounds.min)).toBeCloseTo(3);
    expect(getX(bounds.max)).toBeCloseTo(8);
    expect(getY(bounds.min)).toBeCloseTo(-6);
    expect(getY(bounds.max)).toBeCloseTo(-1);
  });

  test("includes stroke width in computed bounds", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: RectShape = {
      id: "stroked",
      type: "rect",
      geometry: { type: "rect", size: v(10, 10) },
      stroke: { type: "brush", color: "#000", size: 4 },
      transform: {
        translation: v(0, 0),
        rotation: 0,
        scale: v(1, 1),
      },
      zIndex: "stroked",
    };
    const bounds = getShapeBounds(shape, registry);
    expect(getX(bounds.min)).toBe(-5 - 2);
    expect(getX(bounds.max)).toBe(5 + 2);
    expect(getY(bounds.min)).toBe(-5 - 2);
    expect(getY(bounds.max)).toBe(5 + 2);
  });
});
