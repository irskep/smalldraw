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

export function buildJoinUrl(joinSecret: string, baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("join", joinSecret);
  return url.toString();
}

export function resolveJoinBaseUrl(
  configuredBaseUrl: string | undefined,
): string {
  return (
    configuredBaseUrl ??
    globalThis.location?.origin ??
    "https://splatterboard.app"
  );
}

export function buildJoinedCatalogDocUrl(collabDocUrl: string): string {
  const documentId = automergeUrlToDocumentId(collabDocUrl);
  if (documentId) {
    return `catalog-collab:${documentId}`;
  }
  return `catalog-collab:${encodeURIComponent(collabDocUrl)}`;
}
