import { COLORING_TOPICS } from "@smalldraw/shared";

import { type ColoringPageSpec, getColoringPages } from "./catalog";

export interface ColoringCategory {
  id: string;
  title: string;
  pages: readonly ColoringPageSpec[];
  creditsSrc?: string;
}

const SUBJECTS = COLORING_TOPICS.filter(
  (topic) => topic.id !== "public-domain-review",
).map(({ id, title }) => ({ id, title }));

function subjectFor(page: ColoringPageSpec): string {
  const tags = new Set(page.tags);
  const has = (...values: string[]) => values.some((value) => tags.has(value));
  if (has("dinosaurs")) return "dinosaurs";
  if (has("insects", "butterfly")) return "insects";
  if (has("letters")) return "letters";
  if (has("christmas", "easter", "snow", "holidays", "halloween", "valentine"))
    return "holidays";
  if (
    has("magic-animals", "dragon", "unicorn", "princess", "knight", "fairy") ||
    /chibi_princess|fairy_tattoo/.test(page.src)
  )
    return "magic";
  if (
    has("sea", "underwater", "jellyfish", "octopus") ||
    /octo\.|shark_jaws|fishing_fish/.test(page.src)
  )
    return "underwater";
  if (
    has("mandala", "shapes", "mosaic", "celtic", "zentangle", "hasma") ||
    /locked_heart/.test(page.src)
  )
    return "patterns";
  if (has("fruits", "vegetables", "cake")) return "food";
  if (has("artwork", "artworks", "ships", "beach", "surf")) return "art";
  if (
    has("animals", "bird", "birds", "insects", "butterfly") ||
    /butterfly_tattoo/.test(page.src)
  )
    return "animals";
  return "nature";
}

const naturalOrder = new Intl.Collator("en", { numeric: true });

function alphabetOrder(page: ColoringPageSpec): number {
  const letter = /^Skateboard ([A-Z])$/.exec(page.label);
  if (letter) return letter[1].charCodeAt(0) - 65;
  const number = /^Skateboard (\d+)$/.exec(page.label);
  if (number) return 26 + Number(number[1]);
  if (page.volumeId.startsWith("commons-skate-")) return 100;
  // Keep the complete, more intricate patterned alphabet together at the end.
  return 200;
}

function comparePages(a: ColoringPageSpec, b: ColoringPageSpec): number {
  if (a.tags.includes("letters") && b.tags.includes("letters")) {
    return (
      alphabetOrder(a) - alphabetOrder(b) ||
      naturalOrder.compare(a.label, b.label)
    );
  }
  return a.complexity - b.complexity || naturalOrder.compare(a.label, b.label);
}

export function getColoringCategories(): readonly ColoringCategory[] {
  const pages = getColoringPages();
  const subjectPages = pages.filter(
    (page) => page.volumeId === "pavelkukov" || page.tags.length > 0,
  );
  const categories: ColoringCategory[] = SUBJECTS.map((subject) => ({
    ...subject,
    pages: subjectPages
      .filter((page) => subjectFor(page) === subject.id)
      .sort(comparePages),
    creditsSrc: "coloring/credits/credits.txt",
  })).filter((category) => category.pages.length > 0);
  categories.push({
    id: "public-domain-review",
    title: "Public Domain Review",
    pages: pages
      .filter(
        (page) => page.volumeId === "pdr-v1" || page.volumeId === "pdr-v2",
      )
      .sort(comparePages),
  });
  return categories;
}
