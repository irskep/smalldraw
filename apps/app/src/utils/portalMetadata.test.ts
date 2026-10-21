import { expect, test } from "vitest";

import { updatePortalMetadata } from "./portalMetadata";

test("client navigation replaces homepage metadata without duplicates", () => {
  updatePortalMetadata("/");
  updatePortalMetadata("/");
  expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(
    1,
  );
  expect(
    document.head.querySelectorAll('meta[name="description"]'),
  ).toHaveLength(1);
  expect(
    document.head.querySelectorAll('script[type="application/ld+json"]'),
  ).toHaveLength(1);
  updatePortalMetadata("/account");
  expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  expect(
    document.head.querySelector('script[type="application/ld+json"]'),
  ).toBeNull();
  expect(
    document.head.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toBe("noindex, follow");
  updatePortalMetadata("/data");
  expect(document.title).toBe("How your drawings are stored — Splatterboard");
  expect(
    document.head.querySelector('link[rel="canonical"]')?.getAttribute("href"),
  ).toBe("https://splatterboard.app/data");
  updatePortalMetadata("/");
  expect(document.title).toContain("A free drawing app for kids");
});
