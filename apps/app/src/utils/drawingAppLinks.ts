export interface LocationLike {
  protocol: string;
  hostname: string;
}

export function resolveDrawingAppBaseUrl(location: LocationLike): string {
  return `${location.protocol}//${location.hostname}:3000`;
}

export function buildDrawingDocumentUrl(
  documentId: string,
  location: LocationLike = window.location,
): string {
  const url = new URL(resolveDrawingAppBaseUrl(location));
  url.searchParams.set("doc", documentId);
  return url.toString();
}
