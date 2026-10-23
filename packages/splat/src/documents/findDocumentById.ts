import { drawingDocumentId } from "@smalldraw/shared";

import type { KidsDocumentBackend, KidsDocumentSummary } from "./types";

/** Resolve public IDs without exposing catalog aliases or changing stored keys. */
export async function findDocumentById(
  backend: KidsDocumentBackend,
  id: string,
): Promise<KidsDocumentSummary | null> {
  const documents = await backend.listDocuments();
  return (
    documents.find(
      (document) =>
        document.collabDocUrl &&
        drawingDocumentId(document.collabDocUrl) === id,
    ) ??
    documents.find((document) => drawingDocumentId(document.docUrl) === id) ??
    null
  );
}
