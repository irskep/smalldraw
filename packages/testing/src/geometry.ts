import { expect } from "bun:test";

type Vec2Tuple = [number, number];

type ShapeWithPoints = {
  geometry: {
    type?: "pen" | "pen-json";
    points?: Vec2Tuple[];
    pointsJson?: string;
  };
  transform?: {
    translation?: Vec2Tuple;
  };
};

export function getWorldPointsFromShape(shape: ShapeWithPoints): Vec2Tuple[] {
  const translation = shape.transform?.translation ?? [0, 0];
  const points = getShapePoints(shape);
  return points.map(([x, y]) => [
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

function getShapePoints(shape: ShapeWithPoints): Vec2Tuple[] {
  const points = shape.geometry.points ?? [];
  if (points.length > 0) {
    return points;
  }
  const json = shape.geometry.pointsJson;
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    if (parsed.length === 0) {
      return [];
    }
    const first = parsed[0] as unknown;
    if (
      !Array.isArray(first) ||
      typeof first[0] !== "number" ||
      typeof first[1] !== "number"
    ) {
      return [];
    }
    return parsed as Vec2Tuple[];
  } catch {
    return [];
  }
}
