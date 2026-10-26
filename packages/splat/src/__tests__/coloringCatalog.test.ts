import { describe, expect, test } from "bun:test";

import {
  extractColoringPageId,
  getColoringPageById,
} from "../coloring/catalog";

describe("coloring catalog", () => {
  test("uses relative asset paths as canonical page ids", () => {
    const page = getColoringPageById("coloring/pdr-v1/page-005.webp");

    expect(page?.id).toBe("coloring/pdr-v1/page-005.webp");
    expect(page?.src).toBe("coloring/pdr-v1/page-005.webp");
  });

  test("extracts canonical IDs from paths and absolute URLs", () => {
    const id = "coloring/pdr-v1/page-005.webp";
    expect(extractColoringPageId(`/${id}`)).toBe(id);
    expect(extractColoringPageId(`https://splatterboard.app/${id}`)).toBe(id);
    expect(extractColoringPageId("coloring/pdr-v1/missing.webp")).toBeNull();
  });
});

describe("SVG coloring pages", () => {
  test("resolves SVG IDs and asset URLs", () => {
    const id = "coloring/pavelkukov/five_pointed_star.svg";
    const page = getColoringPageById(id);
    expect(page?.src).toBe(id);
    expect(page?.size.width).toBeGreaterThan(0);
    expect(page?.size.height).toBeLessThanOrEqual(1600);
    expect(extractColoringPageId(`https://assets.example.test/${id}`)).toBe(id);
    expect(extractColoringPageId("coloring/pavelkukov/missing.svg")).toBeNull();
  });
});
