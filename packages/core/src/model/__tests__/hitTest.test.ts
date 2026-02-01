import { describe, expect, test } from "bun:test";
import { Vec2 } from "gl-matrix";
import { hitTestShape } from "../hitTest";
import { getDefaultShapeHandlerRegistry } from "../shapeHandlers";
import type { RectShape } from "../shapes/rectShape";

describe("hit testing", () => {
  test("rotated rect ignores points outside the rotated shape", () => {
    const registry = getDefaultShapeHandlerRegistry();
    const shape: RectShape = {
      id: "rot-rect",
      type: "rect",
      geometry: { type: "rect", size: new Vec2(10, 10) },
      transform: {
        translation: new Vec2(),
        rotation: Math.PI / 4,
        scale: new Vec2(1),
      },
      zIndex: "rot-rect",
    };

    expect(hitTestShape(shape, new Vec2(0, 0), registry)).toBe(true);
    expect(hitTestShape(shape, new Vec2(7, 6), registry)).toBe(false);
  });
});
