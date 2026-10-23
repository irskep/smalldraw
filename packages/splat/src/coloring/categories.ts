import { type ColoringPageSpec, getColoringPages } from "./catalog";

export interface ColoringCategory {
  id: string;
  title: string;
  pages: readonly ColoringPageSpec[];
  creditsSrc?: string;
}

const SUBJECTS = [
  { id: "animals", title: "Animals" },
  { id: "dinosaurs", title: "Dinosaurs" },
  { id: "insects", title: "Butterflies & bugs" },
  { id: "underwater", title: "Underwater" },
  { id: "magic", title: "Magic & fairy tales" },
  { id: "nature", title: "Flowers & nature" },
  { id: "food", title: "Food" },
  { id: "letters", title: "Letters & numbers" },
  { id: "holidays", title: "Holidays" },
  { id: "patterns", title: "Shapes & patterns" },
  { id: "art", title: "Art & scenes" },
] as const;

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

export function getColoringCategories(): readonly ColoringCategory[] {
  const pages = getColoringPages();
  const subjectPages = pages.filter(
    (page) => page.volumeId === "pavelkukov" || page.tags.length > 0,
  );
  const categories: ColoringCategory[] = SUBJECTS.map((subject) => ({
    ...subject,
    pages: subjectPages.filter((page) => subjectFor(page) === subject.id),
    creditsSrc: "coloring/credits/credits.txt",
  })).filter((category) => category.pages.length > 0);
  categories.push({
    id: "public-domain-review",
    title: "Public Domain Review",
    pages: pages.filter(
      (page) => page.volumeId === "pdr-v1" || page.volumeId === "pdr-v2",
    ),
  });
  return categories;
}
