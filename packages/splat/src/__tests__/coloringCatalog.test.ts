import { describe, expect, test } from "bun:test";
import {
  extractColoringPageId,
  getColoringPageById,
} from "../coloring/catalog";

describe("coloring catalog", () => {
  test("uses relative asset paths as canonical page ids", () => {
    const page = getColoringPageById("coloring/pdr-v1/page-005.png");

    expect(page?.id).toBe("coloring/pdr-v1/page-005.png");
    expect(page?.src).toBe("coloring/pdr-v1/page-005.png");
  });

  test("extracts canonical ids from old url-shaped values", () => {
    expect(extractColoringPageId("/coloring/pdr-v1/page-005.png")).toBe(
      "coloring/pdr-v1/page-005.png",
    );
    expect(extractColoringPageId("/coloring/pdr-v2/page-005.png")).toBe(
      "coloring/pdr-v2/page-005.png",
    );
    expect(
      extractColoringPageId(
        "https://splatterboard.app/coloring/pdr-v1/page-005-bwkk1f0d.png",
      ),
    ).toBe("coloring/pdr-v1/page-005.png");
    expect(extractColoringPageId("pdr-v1-005")).toBe(
      "coloring/pdr-v1/page-005.png",
    );
    expect(extractColoringPageId("page-005-bwkk1f0d.png")).toBe(
      "coloring/pdr-v1/page-005.png",
    );
  });

  test("maps legacy bare hashed coloring URLs to pdr-v1", () => {
    expect(extractColoringPageId("/assets/page-005-bwkk1f0d.png")).toBe(
      "coloring/pdr-v1/page-005.png",
    );
  });
});
