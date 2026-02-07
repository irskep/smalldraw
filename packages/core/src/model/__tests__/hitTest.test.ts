import { describe, expect, test } from "bun:test";
import { Vec2 } from "gl-matrix";
import { hitTestShape } from "../hitTest";
import { getDefaultShapeHandlerRegistry } from "../shapeHandlers";
import type { RectShape } from "../shapes/rectShape";

describe("hit testing", () => {
  const v = (x = 0, y = x): [number, number] => [x, y];
  test("rotated rect ignores points outside the rotated shape", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: RectShape = {
      id: "rot-rect",
      type: "rect",
      geometry: { type: "rect", size: v(10, 10) },
      style: {},
      transform: {
        translation: v(0, 0),
        rotation: Math.PI / 4,
        scale: v(1, 1),
      },
      zIndex: "rot-rect",
    };

    expect(hitTestShape(shape, new Vec2(0, 0), registry)).toBe(true);
    expect(hitTestShape(shape, new Vec2(7, 6), registry)).toBe(false);
  });
});
