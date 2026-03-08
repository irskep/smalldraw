import type { KidsDocumentSummary } from "./types";

export function resolveDocumentOpenUrl(
  docUrl: string,
  summary: KidsDocumentSummary | null,
): string {
  if (summary?.collaborative && summary.collabDocUrl) {
    return summary.collabDocUrl;
  }
  return docUrl;
}

export function isCollaborativeDocument(
  summary: KidsDocumentSummary | null,
): summary is KidsDocumentSummary & {
  collaborative: true;
  collabDocUrl: string;
} {
  return Boolean(summary?.collaborative && summary.collabDocUrl);
}

export function automergeUrlToDocumentId(url: string): string | null {
  if (!url.startsWith("automerge:")) {
    return null;
  }
  const documentId = url.slice("automerge:".length);
  return documentId.length > 0 ? documentId : null;
}
