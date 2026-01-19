import { describe, expect, test } from "bun:test";

import { getShapeBounds } from "../geometryBounds";
import { getDefaultShapeHandlerRegistry } from "../shapeHandlers";
import type { Shape } from "../shape";

describe("geometry bounds helpers", () => {
  test("computes bounds for rotated rectangle using center-based transform", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: Shape = {
      id: "rect",
      geometry: { type: "rect", size: { width: 20, height: 10 } },
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: Math.PI / 2,
        scale: { x: 1, y: 1 },
      },
      zIndex: "rect",
    };
    const bounds = getShapeBounds(shape, registry);
    expect(bounds.minX).toBeCloseTo(-5);
    expect(bounds.maxX).toBeCloseTo(5);
    expect(bounds.minY).toBeCloseTo(-10);
    expect(bounds.maxY).toBeCloseTo(10);
    expect(bounds.width).toBeCloseTo(10);
    expect(bounds.height).toBeCloseTo(20);
  });

  test("derives bounds from pen geometry points and translation", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: Shape = {
      id: "pen",
      geometry: {
        type: "pen",
        points: [
          { x: -2, y: -1 },
          { x: 3, y: 4 },
        ],
      },
      transform: {
        translation: { x: 5, y: -5 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
      zIndex: "pen",
    };
    const bounds = getShapeBounds(shape, registry);
    expect(bounds.minX).toBeCloseTo(3);
    expect(bounds.maxX).toBeCloseTo(8);
    expect(bounds.minY).toBeCloseTo(-6);
    expect(bounds.maxY).toBeCloseTo(-1);
  });

  test("includes stroke width in computed bounds", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: Shape = {
      id: "stroked",
      geometry: { type: "rect", size: { width: 10, height: 10 } },
      stroke: { type: "brush", color: "#000", size: 4 },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
      zIndex: "stroked",
    };
    const bounds = getShapeBounds(shape, registry);
    expect(bounds.minX).toBe(-5 - 2);
    expect(bounds.maxX).toBe(5 + 2);
    expect(bounds.minY).toBe(-5 - 2);
    expect(bounds.maxY).toBe(5 + 2);
  });
});
