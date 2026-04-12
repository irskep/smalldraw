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
  const url = new URL(currentHref);
  url.searchParams.delete("join");
  url.searchParams.delete("doc");
  url.searchParams.delete("local");

  if (!summary) {
    return url.toString();
  }

  if (summary.accountAttached && summary.collabDocUrl) {
    url.searchParams.set("doc", toDocumentId(summary.collabDocUrl));
    return url.toString();
  }

  url.searchParams.set("local", summary.docUrl);
  return url.toString();
}

function toDocumentId(docUrl: string): string {
  return docUrl.startsWith("automerge:")
    ? docUrl.slice("automerge:".length)
    : docUrl;
}
