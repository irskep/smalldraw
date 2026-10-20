import { expect, test } from "bun:test";
import * as A from "@automerge/automerge";
import { SnapshotCache } from "./snapshotCache";

test("unchanged versions reuse snapshots and edits immediately replace them", () => {
  const cache = new SnapshotCache();
  let doc = A.from({ value: 1 });
  const first = cache.get("id", doc);
  expect(cache.get("id", doc)).toBe(first);
  doc = A.change(doc, (d) => {
    d.value = 2;
  });
  const second = cache.get("id", doc);
  expect(second).not.toBe(first);
  const loaded = A.load<{ value: number }>(second);
  expect(loaded.value).toBe(2);
  expect(cache.size).toBe(1);
  A.free(loaded);
  A.free(doc);
});

test("entry and byte budgets evict least-recently-used snapshots; oversized snapshots bypass cache", () => {
  const doc = A.from({ value: 1 });
  const size = A.save(doc).length;
  const cache = new SnapshotCache(size * 2, 2);
  const a = cache.get("a", doc);
  const b = cache.get("b", doc);
  expect(cache.get("a", doc)).toBe(a);
  cache.get("c", doc);
  expect(cache.size).toBe(2);
  expect(cache.sizeBytes).toBe(size * 2);
  expect(cache.get("a", doc)).toBe(a);
  expect(cache.get("b", doc)).not.toBe(b);
  const tiny = new SnapshotCache(size - 1);
  expect(tiny.get("a", doc)).not.toBe(tiny.get("a", doc));
  expect(tiny.sizeBytes).toBe(0);
  A.free(doc);
});
