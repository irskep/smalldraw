import { expect } from "bun:test";

type Vec2Tuple = [number, number];

type ShapeWithPoints = {
  geometry: {
    points: Vec2Tuple[];
  };
  transform?: {
    translation?: Vec2Tuple;
  };
};

export function getWorldPointsFromShape(shape: ShapeWithPoints): Vec2Tuple[] {
  const translation = shape.transform?.translation ?? [0, 0];
  return shape.geometry.points.map(([x, y]) => [
    x + translation[0],
    y + translation[1],
  ]);
}

export function expectPointsClose(
  received: Vec2Tuple[],
  expected: Vec2Tuple[],
  precision = 3,
): void {
  expect(received).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i += 1) {
    const exp = expected[i];
    const rec = received[i];
    if (exp === undefined || rec === undefined) {
      throw new Error("Point arrays did not match expected length.");
    }
    expect(rec[0]).toBeCloseTo(exp[0], precision);
    expect(rec[1]).toBeCloseTo(exp[1], precision);
  }
}
