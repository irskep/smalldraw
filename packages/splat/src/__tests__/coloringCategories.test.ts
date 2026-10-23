import { describe, expect, test } from "bun:test";

import { getColoringPages } from "../coloring/catalog";
import { getColoringCategories } from "../coloring/categories";

describe("coloring categories", () => {
  test("every imported drawing appears in exactly one nonempty subject category", () => {
    const categories = getColoringCategories();
    const shown = categories
      .flatMap((category) => category.pages)
      .filter((page) => page.tags.length > 0);
    const imported = getColoringPages().filter((page) => page.tags.length > 0);
    expect(shown.length).toBe(imported.length);
    expect(new Set(shown.map((page) => page.id)).size).toBe(imported.length);
    expect(categories.every((category) => category.pages.length > 0)).toBe(
      true,
    );
    expect(shown.some((page) => page.src.endsWith("/blank.svg"))).toBe(false);
  });
  test("Public Domain Review combines both source volumes", () => {
    const categories = getColoringCategories();
    const pdr = categories.find(
      (category) => category.id === "public-domain-review",
    )!;
    expect(new Set(pdr.pages.map((page) => page.volumeId))).toEqual(
      new Set(["pdr-v1", "pdr-v2"]),
    );
    expect(pdr.pages.length).toBe(40);
    expect(
      categories.some((category) => category.title.includes("Volume")),
    ).toBe(false);
  });
  test("PDF drawings join subject categories with credits", () => {
    const dinosaurs = getColoringCategories().find(
      (category) => category.id === "dinosaurs",
    )!;
    expect(dinosaurs.pages.length).toBeGreaterThanOrEqual(20);
    expect(dinosaurs.creditsSrc).toBe("coloring/credits/credits.txt");
    expect(
      dinosaurs.pages.filter((page) => page.volumeId === "peaksel-dinosaurs"),
    ).toHaveLength(20);
  });
});
