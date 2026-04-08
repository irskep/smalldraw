import type { KidsDocumentSummary } from "./types";

export type DocumentClaimState =
  | {
      claimable: true;
      accessToken: string;
    }
  | {
      claimable: false;
      reason:
        | "not_collaborative"
        | "already_attached"
        | "missing_access_token"
        | "wrong_access_scope";
    };

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

export function resolveDocumentClaimState(
  summary: KidsDocumentSummary,
): DocumentClaimState {
  if (!isCollaborativeDocument(summary)) {
    return { claimable: false, reason: "not_collaborative" };
  }
  if (summary.accountAttached) {
    return { claimable: false, reason: "already_attached" };
  }
  if (!summary.accessToken) {
    return { claimable: false, reason: "missing_access_token" };
  }
  if (summary.accessTokenScope !== "owner") {
    return { claimable: false, reason: "wrong_access_scope" };
  }
  return {
    claimable: true,
    accessToken: summary.accessToken,
  };
}
