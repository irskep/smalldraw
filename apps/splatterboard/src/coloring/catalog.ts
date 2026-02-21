import type { DrawingDocumentSize } from "@smalldraw/core";
import { GENERATED_COLORING_ASSETS } from "./generatedColoringPageAssets";

export interface ColoringPageSpec {
  id: string;
  volumeId: "pdr-v1" | "pdr-v2";
  volumeLabel: string;
  pageNumber: number;
  label: string;
  src: string;
  size: DrawingDocumentSize;
}

const COLORING_PAGES: readonly ColoringPageSpec[] = GENERATED_COLORING_ASSETS.map(
  (asset) => {
  const page = `${asset.pageNumber}`.padStart(3, "0");
  const size: DrawingDocumentSize = {
    width: asset.width,
    height: asset.height,
  };
  return {
    id: asset.id,
    volumeId: asset.volumeId,
    volumeLabel: asset.volumeLabel,
    pageNumber: asset.pageNumber,
    label: `${asset.volumeLabel} Page ${page}`,
    src: asset.src,
    size,
  } satisfies ColoringPageSpec;
},
);

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
