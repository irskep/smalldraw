import { describe, expect, test } from "bun:test";
import { createColoringAssetUrlResolver } from "../coloring/assetUrls";

describe("coloring asset URLs", () => {
  test("rewrites legacy coloring URLs to configured absolute asset URLs", () => {
    const resolveAssetUrl = createColoringAssetUrlResolver(
      "https://splatterboard.app",
    );

    expect(resolveAssetUrl("page-005-bwkk1f0d.png")).toBe(
      "https://splatterboard.app/coloring/pdr-v1/page-005.png",
    );
    expect(resolveAssetUrl("/coloring/pdr-v1/page-005-bwkk1f0d.png")).toBe(
      "https://splatterboard.app/coloring/pdr-v1/page-005.png",
    );
  });
});
