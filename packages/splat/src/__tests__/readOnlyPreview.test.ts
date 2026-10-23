import { describe, expect, it } from "bun:test";

import { resolvePreviewImageSource } from "../render/readOnlyPreview";

describe("read-only preview image boundaries", () => {
  const origin = "https://splatterboard.app";
  it("permits built-in image assets and raster data without remote requests", () => {
    expect(resolvePreviewImageSource("/draw/stamp-bird.png", origin)).toBe(
      `${origin}/draw/stamp-bird.png`,
    );
    expect(resolvePreviewImageSource("/coloring/book/page.png", origin)).toBe(
      `${origin}/coloring/book/page.png`,
    );
    expect(
      resolvePreviewImageSource("data:image/png;base64,YQ==", origin),
    ).toBe("data:image/png;base64,YQ==");
  });
  it("rejects remote URLs, arbitrary same-origin endpoints, traversal and SVG", () => {
    for (const src of [
      "https://attacker.test/image.png",
      "//attacker.test/draw/a.png",
      "/api/v1/me",
      "/coloring/../../api/v1/me",
      "data:image/svg+xml;base64,YQ==",
      "javascript:alert(1)",
      "file:///etc/passwd",
    ])
      expect(() => resolvePreviewImageSource(src, origin)).toThrow();
  });
});
