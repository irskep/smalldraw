import { describe, expect, test } from "bun:test";
import {
  getFreehandInputPoints,
  getPenStrokeOptions,
  getPenStrokeOutline,
} from "../penStroke";
import type { PenShape } from "../shapes/penShape";

const v = (x = 0, y = x): [number, number] => [x, y];

function createPenShape(params: {
  points: Array<[number, number]>;
  pressures?: number[];
  size?: number;
}): PenShape {
  return {
    id: "pen-1",
    type: "pen",
    geometry: {
      type: "pen",
      points: params.points,
      ...(params.pressures ? { pressures: params.pressures } : {}),
    },
    style: {
      stroke: {
        type: "brush",
        color: "#000000",
        size: params.size ?? 8,
      },
    },
    zIndex: "a",
    transform: {
      translation: v(0, 0),
      rotation: 0,
      scale: v(1, 1),
    },
  };
}

describe("penStroke perfect-freehand integration", () => {
  test("uses simulated pressure when explicit pressures are absent", () => {
    const shape = createPenShape({
      points: [v(0, 0), v(10, 5), v(20, 10)],
    });
    const options = getPenStrokeOptions(shape);
    expect(options).not.toBeNull();
    expect(options?.simulatePressure).toBe(true);
    expect(options?.last).toBe(true);
  });

  test("uses real pressure when samples are aligned and valid", () => {
    const shape = createPenShape({
      points: [v(0, 0), v(10, 5), v(20, 10)],
      pressures: [0, 0.4, 1],
    });
    const options = getPenStrokeOptions(shape, { last: false });
    expect(options).not.toBeNull();
    expect(options?.simulatePressure).toBe(false);
    expect(options?.last).toBe(false);
  });

  test("falls back to simulated pressure when samples are misaligned", () => {
    const shape = createPenShape({
      points: [v(0, 0), v(10, 5), v(20, 10)],
      pressures: [0.2, 0.8],
    });
    const options = getPenStrokeOptions(shape);
    expect(options).not.toBeNull();
    expect(options?.simulatePressure).toBe(true);
  });

  test("builds freehand input tuples with pressure only when usable", () => {
    const noPressure = createPenShape({
      points: [v(0, 0), v(10, 5)],
    });
    expect(getFreehandInputPoints(noPressure)).toEqual([
      [0, 0],
      [10, 5],
    ]);

    const alignedPressure = createPenShape({
      points: [v(0, 0), v(10, 5)],
      pressures: [0, 0.75],
    });
    expect(getFreehandInputPoints(alignedPressure)).toEqual([
      [0, 0, 0],
      [10, 5, 0.75],
    ]);

    const invalidPressure = createPenShape({
      points: [v(0, 0), v(10, 5)],
      pressures: [0.4, Number.NaN],
    });
    expect(getFreehandInputPoints(invalidPressure)).toEqual([
      [0, 0],
      [10, 5],
    ]);
  });

  test("treats committed stroke end differently from draft stroke end", () => {
    const shape = createPenShape({
      points: [v(0, 0), v(20, 0), v(40, 0)],
      size: 12,
    });

    const draftOutline = getPenStrokeOutline(shape, { last: false });
    const committedOutline = getPenStrokeOutline(shape, { last: true });

    expect(draftOutline.length).toBeGreaterThan(0);
    expect(committedOutline.length).toBeGreaterThan(0);

    const draftMaxX = Math.max(...draftOutline.map((point) => point[0]));
    const committedMaxX = Math.max(
      ...committedOutline.map((point) => point[0]),
    );
    expect(committedMaxX).toBeGreaterThanOrEqual(draftMaxX);
  });
});
