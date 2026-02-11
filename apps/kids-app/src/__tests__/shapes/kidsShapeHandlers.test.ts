import { describe, expect, test } from "bun:test";
import {
  type BoxedShape,
  createPenJSONGeometry,
  getShapeBounds,
  hitTestShape,
  type PenShape,
} from "@smalldraw/core";
import { BoxOperations, getX, getY } from "@smalldraw/geometry";
import { Vec2 } from "gl-matrix";
import { createKidsShapeHandlerRegistry } from "../../shapes/kidsShapeHandlers";

describe("kids shape handlers", () => {
  const v = (x = 0, y = x): [number, number] => [x, y];

  test("computes bounds for rotated boxed and translated pen shapes", () => {
    const registry = createKidsShapeHandlerRegistry();
    const rect: BoxedShape = {
      id: "rect",
      type: "boxed",
      geometry: { type: "boxed", kind: "rect", size: v(20, 10) },
      style: {},
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: v(0, 0),
        rotation: Math.PI / 2,
        scale: v(1, 1),
      },
      zIndex: "rect",
    };
    const rectBounds = getShapeBounds(rect, registry);
    expect(getX(rectBounds.min)).toBeCloseTo(-5);
    expect(getX(rectBounds.max)).toBeCloseTo(5);
    expect(getY(rectBounds.min)).toBeCloseTo(-10);
    expect(getY(rectBounds.max)).toBeCloseTo(10);
    expect(new BoxOperations(rectBounds).width).toBeCloseTo(10);
    expect(new BoxOperations(rectBounds).height).toBeCloseTo(20);

    const pen: PenShape = {
      id: "pen",
      type: "pen",
      geometry: createPenJSONGeometry([v(-2, -1), v(3, 4)]),
      style: {
        stroke: {
          type: "brush",
          color: "#000000",
          size: 0,
          brushId: "freehand",
        },
      },
      transform: {
        translation: v(5, -5),
        rotation: 0,
        scale: v(1, 1),
      },
      zIndex: "pen",
    };
    const penBounds = getShapeBounds(pen, registry);
    expect(getX(penBounds.min)).toBeCloseTo(3);
    expect(getX(penBounds.max)).toBeCloseTo(8);
    expect(getY(penBounds.min)).toBeCloseTo(-6);
    expect(getY(penBounds.max)).toBeCloseTo(-1);
  });

  test("rotated boxed hit testing excludes outside points", () => {
    const registry = createKidsShapeHandlerRegistry();
    const shape: BoxedShape = {
      id: "rot-rect",
      type: "boxed",
      geometry: { type: "boxed", kind: "rect", size: v(10, 10) },
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
