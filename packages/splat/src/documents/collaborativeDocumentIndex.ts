import { automergeUrlToDocumentId } from "./collaboration";
import type { KidsDocumentSummary } from "./types";

export interface CollaborativeDocumentIndex {
  hasDocumentId(documentId: string): Promise<boolean>;
  upsertSummary(summary: KidsDocumentSummary | null): void;
}

export function createCollaborativeDocumentIndex(options: {
  listDocuments: () => Promise<KidsDocumentSummary[]>;
}): CollaborativeDocumentIndex {
  let hydrated = false;
  let hydratePromise: Promise<void> | null = null;
  const collaborativeDocIdByCatalogDocUrl = new Map<string, string>();
  const collaborativeDocIds = new Set<string>();

  const setSummary = (summary: KidsDocumentSummary): void => {
    const existing = collaborativeDocIdByCatalogDocUrl.get(summary.docUrl);
    if (existing) {
      collaborativeDocIds.delete(existing);
      collaborativeDocIdByCatalogDocUrl.delete(summary.docUrl);
    }
    if (!summary.collaborative || !summary.collabDocUrl) {
      return;
    }
    const documentId = automergeUrlToDocumentId(summary.collabDocUrl);
    if (!documentId) {
      return;
    }
    collaborativeDocIdByCatalogDocUrl.set(summary.docUrl, documentId);
    collaborativeDocIds.add(documentId);
  };

  const hydrate = async (): Promise<void> => {
    collaborativeDocIdByCatalogDocUrl.clear();
    collaborativeDocIds.clear();
    const documents = await options.listDocuments();
    for (const summary of documents) {
      setSummary(summary);
    }
    hydrated = true;
  };

  const ensureHydrated = async (): Promise<void> => {
    if (hydrated) {
      return;
    }
    if (!hydratePromise) {
      hydratePromise = hydrate().finally(() => {
        hydratePromise = null;
      });
    }
    await hydratePromise;
  };

  return {
    async hasDocumentId(documentId: string): Promise<boolean> {
      await ensureHydrated();
      return collaborativeDocIds.has(documentId);
    },
    upsertSummary(summary: KidsDocumentSummary | null): void {
      if (!summary) {
        return;
      }
      setSummary(summary);
      hydrated = true;
    },
  };
}
