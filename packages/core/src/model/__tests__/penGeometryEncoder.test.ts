import { expect, test } from "bun:test";
import type { Vec2Tuple } from "@smalldraw/geometry";
import {
  createAppendOnlyPenGeometryEncoder,
  createPenJSONGeometry,
  getPenGeometryPoints,
} from "../shapes/penShape";

test("incremental geometry matches full encoding across batches and retains prior snapshots", () => {
  const encode = createAppendOnlyPenGeometryEncoder();
  const points: Vec2Tuple[] = [];
  expect(encode(points)).toEqual(createPenJSONGeometry(points));
  const snapshots = [];
  for (const count of [1, 3, 100, 4000]) {
    while (points.length < count) {
      const i = points.length;
      points.push([Math.fround(Math.sin(i) * 100), Math.fround(i / 3)]);
    }
    const geometry = encode(points);
    expect(geometry).toEqual(createPenJSONGeometry(points));
    snapshots.push({ geometry, expected: points.slice() });
    expect(encode(points)).toEqual(geometry);
  }
  for (const { geometry, expected } of snapshots)
    expect(getPenGeometryPoints(geometry)).toEqual(expected);
});

test("new input never reads previously encoded coordinates", () => {
  const encode = createAppendOnlyPenGeometryEncoder();
  const points: Vec2Tuple[] = [[1, 2]];
  encode(points);
  Object.defineProperty(points, 0, {
    get() {
      throw new Error("revisited old point");
    },
  });
  points.push([3, 4]);
  expect(encode(points).pointsJson).toBe("[[1,2],[3,4]]");
});

test("pressure samples including zero survive incremental encoding", () => {
  const encode = createAppendOnlyPenGeometryEncoder();
  const points: Vec2Tuple[] = [
    [1, 2],
    [3, 4],
  ];
  expect(encode(points, [0, 0.8])).toEqual(
    createPenJSONGeometry(points, [0, 0.8]),
  );
  expect(() => encode([])).toThrow("append-only");
});
