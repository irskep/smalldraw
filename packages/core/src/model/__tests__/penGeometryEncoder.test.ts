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
  expect(encode(points).pointsJson.toString()).toBe("[[1,2],[3,4]]");
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

test("local previews read cached coordinates without accessing serialized history", () => {
  const encode = createAppendOnlyPenGeometryEncoder();
  const geometry = encode([[123.25, 456.75]]);
  Object.defineProperty(geometry, "pointsJson", {
    get() {
      throw new Error("read serialized history");
    },
  });
  const points = getPenGeometryPoints(geometry);
  expect(points).toEqual([[123.25, 456.75]]);
  expect(getPenGeometryPoints(geometry)).toBe(points);
});

test("snapshot coordinates are isolated from caller mutations and later appends", () => {
  const encode = createAppendOnlyPenGeometryEncoder();
  const points: Vec2Tuple[] = [[3, 4]];
  const first = encode(points);
  // Even a caller editing its input tuple cannot alter the encoded snapshot.
  points[0][0] = 999;
  const firstRead = getPenGeometryPoints(first);
  expect(firstRead).toEqual([[3, 4]]);
  firstRead[0][0] = -999;
  firstRead.push([8, 9]);
  points.push([5, 6]);
  const second = encode(points);
  expect(getPenGeometryPoints(second)).toEqual([
    [3, 4],
    [5, 6],
  ]);
  expect(getPenGeometryPoints(JSON.parse(JSON.stringify(second)))).toEqual([
    [3, 4],
    [5, 6],
  ]);
});

test("cached snapshots match persisted decoding for JSON number normalization", () => {
  const encode = createAppendOnlyPenGeometryEncoder();
  const geometry = encode([
    [-0, 0],
    [NaN, 4],
    [3, Infinity],
    [1e-30, 1e30],
  ]);
  const persisted = JSON.parse(JSON.stringify(geometry));
  expect(getPenGeometryPoints(geometry)).toEqual(
    getPenGeometryPoints(persisted),
  );
  expect(Object.is(getPenGeometryPoints(geometry)[0][0], -0)).toBe(false);
});
