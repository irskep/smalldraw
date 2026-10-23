import type { DrawingDocumentSize } from "@smalldraw/core";

import { GENERATED_COLORING_ASSETS } from "./generatedColoringPageAssets";
import pdfPages from "./pdfPages.json";
import rasterComplexity from "./rasterComplexity.json";
import svgCollection from "./svgPages.json";

export interface ColoringPageSpec {
  id: string;
  volumeId: string;
  volumeLabel: string;
  sourceUrl: string | null;
  pageNumber: number;
  label: string;
  src: string;
  previewSrc: string;
  size: DrawingDocumentSize;
  tags: readonly string[];
  complexity: number;
}

const COLORING_PAGES: readonly ColoringPageSpec[] = [
  ...svgCollection.pages.map((page, index): ColoringPageSpec => ({
    id: `coloring/pavelkukov/${page.filename}`,
    src: `coloring/pavelkukov/${page.filename}`,
    previewSrc: `coloring/pavelkukov/${page.preview}`,
    volumeId: "pavelkukov",
    volumeLabel: "Coloring pages",
    sourceUrl: page.sourceUrl || "https://github.com/pavelkukov/coloring-pages",
    pageNumber: index + 1,
    label: page.label,
    tags: page.tags,
    complexity: page.complexity,
    size: { width: page.width, height: page.height },
  })),
  ...pdfPages.map((page): ColoringPageSpec => ({
    id: page.id,
    src: page.id,
    previewSrc: page.preview,
    label: page.label,
    tags: page.tags,
    complexity: page.complexity,
    volumeId: page.sourceId,
    volumeLabel: "Coloring pages",
    sourceUrl: page.sourceUrl,
    pageNumber: page.pageNumber,
    size: { width: page.width, height: page.height },
  })),
  ...GENERATED_COLORING_ASSETS.map((asset) => {
    const page = `${asset.pageNumber}`.padStart(3, "0");
    const id = asset.src.replace(/^\/+/, "");
    const size: DrawingDocumentSize = {
      width: asset.width,
      height: asset.height,
    };
    return {
      id,
      volumeId: asset.volumeId,
      volumeLabel: asset.volumeLabel,
      sourceUrl: asset.sourceUrl,
      pageNumber: asset.pageNumber,
      label: `${asset.volumeLabel} Page ${page}`,
      src: id,
      previewSrc: id,
      size,
      tags: [],
      complexity: (rasterComplexity as Record<string, number>)[id] ?? 0,
    } satisfies ColoringPageSpec;
  }),
];

const COLORING_PAGE_BY_ID = new Map(
  COLORING_PAGES.map((page) => [page.id, page] as const),
);
const COLORING_PAGE_BY_SRC = new Map(
  COLORING_PAGES.map((page) => [page.src, page] as const),
);

export const DEFAULT_COLORING_PAGE_ID = COLORING_PAGES[0].id;

export function getColoringPages(): readonly ColoringPageSpec[] {
  return COLORING_PAGES;
}

export function getColoringPageById(pageId: string): ColoringPageSpec | null {
  return COLORING_PAGE_BY_ID.get(pageId) ?? null;
}

export function getColoringPageBySrc(src: string): ColoringPageSpec | null {
  return COLORING_PAGE_BY_SRC.get(src) ?? null;
}

export function extractColoringPageId(value: string): string | null {
  const normalized = normalizeColoringPageId(value);
  if (!normalized) {
    return null;
  }
  return COLORING_PAGE_BY_ID.has(normalized) ? normalized : null;
}

function normalizeColoringPageId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  let pathname = trimmed;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    // Not an absolute URL; treat it as a path-like catalog id.
  }
  const canonical = pathname.replace(/^\/+/, "");
  if (COLORING_PAGE_BY_ID.has(canonical)) return canonical;
  const legacyIdMatch = /^([^/]+)-(\d{3})$/.exec(pathname);
  if (legacyIdMatch) {
    return `coloring/${legacyIdMatch[1]}/page-${legacyIdMatch[2]}.png`;
  }
  const match = pathname.match(
    /(?:^|\/)coloring\/([^/]+)\/(page-\d{3})(?:-[^/.]+)?\.png$/,
  );
  if (match) {
    return `coloring/${match[1]}/${match[2]}.png`;
  }
  const legacyPdrV1Match = /(?:^|\/)(page-\d{3})(?:-[^/.]+)?\.png$/.exec(
    pathname,
  );
  if (legacyPdrV1Match) {
    return `coloring/pdr-v1/${legacyPdrV1Match[1]}.png`;
  }
  return null;
}
