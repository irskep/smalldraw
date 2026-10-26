import { expect, test } from "bun:test";

import {
  planAssetVerification,
  fetchPublicAsset,
  type RemoteAsset,
} from "./coloring-asset-verification";
import type { PublishedAsset } from "./prepare-coloring-assets";

const entries: PublishedAsset[] = Array.from({ length: 8 }, (_, n) => ({
  source: `/local/${n}`,
  key: `coloring/${n < 4 ? "cats" : "birds"}/version/${n}.webp`,
  size: 100 + n,
  md5: `checksum-${n}`,
  contentType:
    n === 0
      ? "image/svg+xml"
      : n === 1
        ? "text/plain; charset=utf-8"
        : "image/webp",
  ...(n === 0 ? { contentEncoding: "gzip" } : {}),
}));
const inventory = () =>
  new Map<string, RemoteAsset>(
    entries.map((e) => [e.key, { size: e.size, etag: e.md5 }]),
  );
const receipts = () =>
  new Set(planAssetVerification(entries, inventory(), new Set()).writeRecords);

test("first publication verifies every URL; unchanged publication checks only MIME/encoding probes", () => {
  const first = planAssetVerification(entries, inventory(), new Set());
  expect(first.verify.size).toBe(8);
  expect(first.writeRecords).toHaveLength(2);
  const next = planAssetVerification(entries, inventory(), receipts());
  expect(next.verify.size).toBe(3);
  expect(next.reusedCollections).toBe(2);
  expect(next.writeRecords).toHaveLength(0);
});

test("restoring one missing object rechecks its entire collection despite an old receipt", () => {
  const remote = inventory();
  remote.delete(entries[2].key);
  const plan = planAssetVerification(entries, remote, receipts());
  for (const e of entries.slice(0, 4))
    expect(plan.verify.has(e.key)).toBe(true);
  expect(plan.writeRecords).toHaveLength(1);
  expect(plan.reusedCollections).toBe(1);
});

test("changed response metadata invalidates the receipt even with unchanged bytes", () => {
  const changed = entries.map((e) => ({ ...e }));
  changed[2].contentType = "image/png";
  expect(
    planAssetVerification(changed, inventory(), receipts()).writeRecords,
  ).toHaveLength(1);
});

test("receipts do not depend on local paths or manifest order", () => {
  const moved = entries
    .map((e) => ({ ...e, source: `/other${e.source}` }))
    .reverse();
  expect(
    planAssetVerification(moved, inventory(), receipts()).reusedCollections,
  ).toBe(2);
});

test("receipts never hide remote checksum or size mismatches", () => {
  for (const change of [{ size: 0 }, { etag: "wrong" }]) {
    const remote = inventory();
    remote.set(entries[3].key, { ...remote.get(entries[3].key)!, ...change });
    expect(() => planAssetVerification(entries, remote, receipts())).toThrow(
      "Immutable object mismatch",
    );
  }
});

test("audit ignores receipts, checks every URL, and writes no records", () => {
  const plan = planAssetVerification(entries, inventory(), receipts(), true);
  expect(plan.verify.size).toBe(entries.length);
  expect(plan.writeRecords).toHaveLength(0);
  const missing = inventory();
  missing.delete(entries[0].key);
  expect(() =>
    planAssetVerification(entries, missing, receipts(), true),
  ).toThrow("Missing object");
});

test("CDN throttling respects Retry-After; permanent failures do not retry", async () => {
  let calls = 0;
  const delays: number[] = [];
  const request = async () =>
    ++calls === 1
      ? new Response(null, { status: 429, headers: { "Retry-After": "2" } })
      : new Response(null, { status: 200 });
  expect(
    (
      await fetchPublicAsset("test", request, async (ms) => {
        delays.push(ms);
      })
    ).status,
  ).toBe(200);
  expect(calls).toBe(2);
  expect(delays).toEqual([2000]);
  calls = 0;
  const missing = async () => {
    calls++;
    return new Response(null, { status: 404 });
  };
  expect((await fetchPublicAsset("test", missing)).status).toBe(404);
  expect(calls).toBe(1);
});

test("transient CDN retries are bounded and never turn a failure into success", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    return new Response(null, { status: 503 });
  };
  expect((await fetchPublicAsset("test", request, async () => {})).status).toBe(
    503,
  );
  expect(calls).toBe(4);
});
