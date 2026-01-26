import { describe, expect, test } from "bun:test";
import { makePoint } from "../makePoint";
import { angleBetween, distance, rotatePoint } from "../pointFunctions";

const EPSILON = 1e-6;

describe("pointFunctions", () => {
  test("distance uses Euclidean length", () => {
    const a = makePoint(0, 0);
    const b = makePoint(3, 4);

    expect(distance(a, b)).toBeCloseTo(5, 6);
  });

  test("rotatePoint rotates around origin", () => {
    const point = makePoint(1, 0);
    const rotated = rotatePoint(point, Math.PI / 2);

    expect(rotated.x).toBeCloseTo(0, 6);
    expect(rotated.y).toBeCloseTo(1, 6);
  });

  test("angleBetween returns the angle between vectors", () => {
    const a = makePoint(1, 0);
    const b = makePoint(0, 1);

    expect(angleBetween(a, b)).toBeCloseTo(Math.PI / 2, 6);
  });

  test("angleBetween handles opposite vectors", () => {
    const a = makePoint(1, 0);
    const b = makePoint(-1, 0);

    expect(angleBetween(a, b)).toBeCloseTo(Math.PI, 6);
  });

  test("rotatePoint preserves distance from origin", () => {
    const point = makePoint(3, 4);
    const rotated = rotatePoint(point, Math.PI / 3);

    expect(distance(makePoint(0, 0), point)).toBeCloseTo(5, 6);
    expect(distance(makePoint(0, 0), rotated)).toBeCloseTo(5, 6);
    expect(Math.abs(rotated.x)).toBeGreaterThan(EPSILON);
  });
});
