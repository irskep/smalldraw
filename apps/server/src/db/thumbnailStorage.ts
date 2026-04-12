export function buildDocumentThumbnailStorageKey(documentId: string): string {
  return `documents/${documentId}/thumbnail.png`;
}

export function buildDocumentThumbnailUrl(
  storageKey: string,
  publicBaseUrl: string | undefined,
): string | null {
  if (!publicBaseUrl) {
    return null;
  }
  const trimmedBaseUrl = publicBaseUrl.replace(/\/+$/, "");
  const trimmedStorageKey = storageKey.replace(/^\/+/, "");
  return `${trimmedBaseUrl}/${trimmedStorageKey}`;
}
