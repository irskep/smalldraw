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
  if (!summary) {
    return buildDrawingAppUrl(currentHref);
  }

  if (summary.accountAttached && summary.collabDocUrl) {
    return buildDrawingAppUrl(currentHref, {
      type: "account",
      documentId: toDocumentId(summary.collabDocUrl),
    });
  }

  return buildDrawingAppUrl(currentHref, {
    type: "local",
    docUrl: summary.docUrl,
  });
}

function toDocumentId(docUrl: string): string {
  return docUrl.startsWith("automerge:")
    ? docUrl.slice("automerge:".length)
    : docUrl;
}
