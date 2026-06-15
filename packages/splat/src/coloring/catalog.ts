import type { DrawingDocumentSize } from "@smalldraw/core";
import { GENERATED_COLORING_ASSETS } from "./generatedColoringPageAssets";

export interface ColoringPageSpec {
  id: string;
  volumeId: string;
  volumeLabel: string;
  sourceUrl: string | null;
  pageNumber: number;
  label: string;
  src: string;
  size: DrawingDocumentSize;
}

const COLORING_PAGES: readonly ColoringPageSpec[] =
  GENERATED_COLORING_ASSETS.map((asset) => {
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
      size,
    } satisfies ColoringPageSpec;
  });

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
