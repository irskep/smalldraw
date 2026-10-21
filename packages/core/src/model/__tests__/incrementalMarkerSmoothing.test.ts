import { expect, test } from "bun:test";

import type { Vec2Tuple } from "@smalldraw/geometry";

import { smoothMarkerPoints, smoothMarkerTail } from "../markerSmoothing";

test("overlapping smoothing tails match full smoothing exactly and preserve the stable prefix", () => {
  for (const batch of [1, 3, 17]) {
    const input: Vec2Tuple[] = [];
    let previousCount = 0;
    let stable: Vec2Tuple[] = [];
    let stableSegments = 0;
    for (let end = batch; end < 200; end += batch) {
      while (input.length < end) {
        const i = input.length;
        input.push([Math.sin(i * 7) * 1e6, Math.cos(i / 3) / 7]);
      }
      const tail = smoothMarkerTail(input, previousCount);
      const full = smoothMarkerPoints(input);
      // Include the previous neighbour needed by the first newly added cubic.
      const firstUsed = Math.max(0, stableSegments - 1);
      expect(tail.points.slice(firstUsed - tail.offset)).toEqual(
        full.slice(firstUsed),
      );
      expect(full.slice(0, stable.length)).toEqual(stable);
      stable = full.slice(0, tail.stableCount);
      stableSegments = Math.max(0, tail.stableCount - 2);
      previousCount = input.length;
      expect(tail.points.length).toBeLessThanOrEqual(8 * (batch + 4) + 7);
    }
  }
});

test("initial smoothing handles empty, single, and repeated-point strokes", () => {
  const cases: Vec2Tuple[][] = [
    [],
    [[1, 2]],
    [
      [1, 2],
      [1, 2],
    ],
    [
      [7, 9],
      [2, 5],
    ],
  ];
  for (const points of cases)
    expect(smoothMarkerTail(points, 0).points).toEqual(
      smoothMarkerPoints(points),
    );
});
