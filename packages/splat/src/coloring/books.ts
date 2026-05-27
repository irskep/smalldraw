import { type ColoringPageSpec, getColoringPages } from "./catalog";

export interface ColoringBookSpec {
  id: string;
  title: string;
  volumeLabel: string;
  sourceLabel: string;
  sourceUrl: string | null;
  pageCount: number;
  coverPageSrc: string | null;
  pages: readonly ColoringPageSpec[];
}

function simplifyVolumeTitle(volumeLabel: string): string {
  const colonIndex = volumeLabel.indexOf(":");
  const candidate =
    colonIndex >= 0 ? volumeLabel.slice(colonIndex + 1).trim() : volumeLabel;
  return candidate.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function resolveSourceLabel(sourceUrl: string | null): string {
  if (!sourceUrl) {
    return "Built in";
  }
  try {
    const url = new URL(sourceUrl);
    if (url.hostname === "library.nyam.org") {
      return "NYAM ColorOurCollections";
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "External source";
  }
}

export function getColoringBooks(): readonly ColoringBookSpec[] {
  const pages = getColoringPages();
  const pagesByVolume = new Map<string, ColoringPageSpec[]>();
  for (const page of pages) {
    const volumePages = pagesByVolume.get(page.volumeId) ?? [];
    volumePages.push(page);
    pagesByVolume.set(page.volumeId, volumePages);
  }

  return Array.from(pagesByVolume.entries())
    .map(([id, volumePages]) => {
      const sortedPages = [...volumePages].sort(
        (a, b) => a.pageNumber - b.pageNumber,
      );
      const firstPage = sortedPages[0] ?? null;
      return {
        id,
        title: simplifyVolumeTitle(firstPage?.volumeLabel ?? id),
        volumeLabel: firstPage?.volumeLabel ?? id,
        sourceLabel: resolveSourceLabel(firstPage?.sourceUrl ?? null),
        sourceUrl: firstPage?.sourceUrl ?? null,
        pageCount: sortedPages.length,
        coverPageSrc: firstPage?.src ?? null,
        pages: sortedPages,
      } satisfies ColoringBookSpec;
    })
    .sort((a, b) => {
      const aBuiltin = a.sourceUrl === null ? 0 : 1;
      const bBuiltin = b.sourceUrl === null ? 0 : 1;
      if (aBuiltin !== bBuiltin) {
        return aBuiltin - bBuiltin;
      }
      return a.title.localeCompare(b.title);
    });
}
