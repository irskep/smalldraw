import { describe, expect, test } from "bun:test";

import { createColoringAssetUrlResolver } from "../coloring/assetUrls";

describe("coloring asset URLs", () => {
  test("resolves coloring URLs to configured absolute asset URLs", () => {
    const resolveAssetUrl = createColoringAssetUrlResolver(
      "https://splatterboard.app",
    );

    expect(resolveAssetUrl("coloring/pdr-v1/page-005.webp")).toBe(
      "https://splatterboard.app/coloring/pdr-v1/page-005.webp",
    );
    expect(resolveAssetUrl("/coloring/pdr-v2/page-005.webp")).toBe(
      "https://splatterboard.app/coloring/pdr-v2/page-005.webp",
    );
  });
});

test("resolves dedicated previews without turning them into full artwork URLs", () => {
  const resolve = createColoringAssetUrlResolver("https://example.com/draw");
  expect(resolve("coloring/peaksel-dinosaurs/page-017-preview.webp")).toBe(
    "https://example.com/draw/coloring/peaksel-dinosaurs/page-017-preview.webp",
  );
  expect(resolve("coloring/pavelkukov/camel-preview.webp")).toBe(
    "https://example.com/draw/coloring/pavelkukov/camel-preview.webp",
  );
});
