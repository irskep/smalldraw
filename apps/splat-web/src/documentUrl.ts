import { buildDrawingAppUrl } from "@smalldraw/shared";

export interface SplatDocumentUrlSummary {
  docUrl: string;
  collaborative?: boolean;
  collabDocUrl?: string;
  accountAttached?: boolean;
}

export function buildSplatCurrentDocumentUrl(
  currentHref: string,
  summary: SplatDocumentUrlSummary | null,
): string {
  if (!summary) return currentHref;
  return buildDrawingAppUrl(currentHref, {
    type: "local",
    docUrl: summary.collabDocUrl ?? summary.docUrl,
  });
}
