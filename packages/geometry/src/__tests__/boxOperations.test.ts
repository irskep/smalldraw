import { describe, expect, test } from "bun:test";
import { BoxOperations } from "../BoxOperations";
import { makePoint } from "../makePoint";

function expectPoint(point: { x: number; y: number }, x: number, y: number) {
  expect(point.x).toBeCloseTo(x, 6);
  expect(point.y).toBeCloseTo(y, 6);
}

describe("BoxOperations", () => {
  test("fromPointPair creates min/max points", () => {
    const a = makePoint(5, -2);
    const b = makePoint(-1, 3);

    const box = BoxOperations.fromPointPair(a, b);

    expectPoint(box.min, -1, -2);
    expectPoint(box.max, 5, 3);
  });

  test("fromPointArray returns null for empty arrays", () => {
    expect(BoxOperations.fromPointArray([])).toBeNull();
  });

  test("fromPointArray finds bounds for a set of points", () => {
    const points = [makePoint(1, 1), makePoint(-3, 4), makePoint(2, -2)];

    const box = BoxOperations.fromPointArray(points);

    expect(box).not.toBeNull();
    expectPoint(box!.min, -3, -2);
    expectPoint(box!.max, 2, 4);
  });

  test("fromBoxPair merges two boxes", () => {
    const left = BoxOperations.fromPointPair(makePoint(0, 0), makePoint(2, 1));
    const right = BoxOperations.fromPointPair(
      makePoint(1, -3),
      makePoint(4, 2),
    );

    const merged = BoxOperations.fromBoxPair(left, right);

    expectPoint(merged.min, 0, -3);
    expectPoint(merged.max, 4, 2);
  });

  test("size and center derive from min/max", () => {
    const box = BoxOperations.fromPointPair(makePoint(2, 1), makePoint(6, 5));
    const ops = new BoxOperations(box);

    expectPoint(ops.size, 4, 4);
    expectPoint(ops.center, 4, 3);
    expect(ops.minX).toBe(2);
    expect(ops.minY).toBe(1);
    expect(ops.maxX).toBe(6);
    expect(ops.maxY).toBe(5);
  });

  test("containsPoint is inclusive of edges", () => {
    const box = BoxOperations.fromPointPair(makePoint(0, 0), makePoint(2, 2));
    const ops = new BoxOperations(box);

    expect(ops.containsPoint(makePoint(0, 0))).toBe(true);
    expect(ops.containsPoint(makePoint(2, 2))).toBe(true);
    expect(ops.containsPoint(makePoint(3, 1))).toBe(false);
  });

  test("translate offsets min and max points", () => {
    const box = BoxOperations.fromPointPair(makePoint(-1, 2), makePoint(3, 5));
    const ops = new BoxOperations(box);

    const translated = ops.translate(makePoint(2, -3));

    expectPoint(translated.min, 1, -1);
    expectPoint(translated.max, 5, 2);
  });
});
