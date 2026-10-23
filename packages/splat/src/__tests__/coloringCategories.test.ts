import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { COLORING_TOPICS } from "@smalldraw/shared";

import { getColoringPages } from "../coloring/catalog";
import { getColoringCategories } from "../coloring/categories";

describe("coloring categories", () => {
  test("every public topic has a nonempty curated collection", () => {
    const categories = getColoringCategories();
    expect(categories.map((category) => category.id)).toEqual(
      COLORING_TOPICS.map((topic) => topic.id),
    );
    for (const category of categories)
      expect(category.pages.length).toBeGreaterThan(0);
  });
  test("every gallery page ships both compact thumbnail sizes", () => {
    for (const page of getColoringCategories().flatMap(
      (category) => category.pages,
    )) {
      for (const size of [256, 512]) {
        const path = page.previewSrc
          .replace(/^coloring\//, "")
          .replace(/\.png$/, `-thumb-${size}.webp`);
        expect(
          existsSync(resolve(import.meta.dir, "../coloring/assets", path)),
        ).toBe(true);
      }
    }
  });
  test("only complete alphabets remain, with letters before numbers and charts", () => {
    const letters = getColoringCategories().find(
      (category) => category.id === "letters",
    )!.pages;
    const alphabet = Array.from({ length: 26 }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    expect(letters.slice(0, 26).map((page) => page.label)).toEqual(
      alphabet.map((letter) => `Skateboard ${letter}`),
    );
    expect(letters.slice(26, 37).map((page) => page.label)).toEqual(
      Array.from({ length: 11 }, (_, i) => `Skateboard ${i}`),
    );
    expect(
      letters.slice(37, 40).every((page) => page.volumeId.includes("chart")),
    ).toBe(true);
    expect(letters.slice(40).map((page) => page.label)).toEqual(
      alphabet.map((letter) => `Patterned ${letter}`),
    );
    expect(
      getColoringPages().some(
        (page) =>
          page.volumeId.startsWith("commons-heart-") ||
          /is for/i.test(page.label),
      ),
    ).toBe(false);
  });
  test("other subjects progress from simpler to denser artwork", () => {
    for (const category of getColoringCategories()) {
      if (category.id === "letters") continue;
      const scores = category.pages.map((page) => page.complexity);
      expect(scores.every((score) => Number.isFinite(score) && score > 0)).toBe(
        true,
      );
      expect(scores).toEqual([...scores].sort((a, b) => a - b));
    }
  });
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
