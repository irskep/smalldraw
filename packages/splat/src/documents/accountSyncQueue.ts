import type { DocHandle, Repo } from "@automerge/automerge-repo/slim";
import { atom } from "nanostores";

import type { KidsDocumentBackend, KidsDocumentSummary } from "./types";

const binaryUrl = (document: KidsDocumentSummary) =>
  document.collabDocUrl ?? document.docUrl;
type Batch = {
  documents: KidsDocumentSummary[];
  revisions: Map<string, number>;
};

/** Scan once for crash/offline recovery, then follow document and catalog events. */
export function createAccountSyncQueue(
  repo: Repo,
  backend: KidsDocumentBackend,
) {
  const dirty = atom<ReadonlyMap<string, number>>(new Map());
  let catalog = new Map<string, KidsDocumentSummary>();
  let refreshCatalog = true;
  const subscriptions = new Map<DocHandle<unknown>, () => void>();
  const mark = (url: string) => {
    const next = new Map(dirty.get());
    next.set(url, (next.get(url) ?? 0) + 1);
    dirty.set(next);
    if (!catalog.has(url)) refreshCatalog = true;
  };
  const attach = ({ handle }: { handle: DocHandle<unknown> }) => {
    if (subscriptions.has(handle)) return;
    const changed = () => mark(handle.url);
    handle.on("heads-changed", changed);
    subscriptions.set(handle, () => handle.off("heads-changed", changed));
    mark(handle.url);
  };
  const deleted = ({ documentId }: { documentId: string }) => {
    for (const [handle, unsubscribe] of subscriptions) {
      if (handle.documentId !== documentId) continue;
      unsubscribe();
      subscriptions.delete(handle);
    }
    refreshCatalog = true;
  };
  repo.on("document", attach);
  repo.on("delete-document", deleted);
  for (const handle of Object.values(repo.handles)) attach({ handle });
  const catalogChanged = () => {
    refreshCatalog = true;
  };
  window.addEventListener("drawing-catalog-change", catalogChanged);
  return {
    async take(): Promise<Batch> {
      if (refreshCatalog) {
        // Leave any event raised during the read pending for the next batch.
        refreshCatalog = false;
        let documents: KidsDocumentSummary[];
        try {
          documents = await backend.listDocuments();
        } catch (error) {
          refreshCatalog = true;
          throw error;
        }
        const previous = catalog;
        catalog = new Map(
          documents.map((document) => [binaryUrl(document), document]),
        );
        for (const [url, document] of catalog) {
          const old = previous.get(url);
          if (
            !old ||
            old.accountAttached !== document.accountAttached ||
            old.docUrl !== document.docUrl
          )
            mark(url);
        }
      }
      const revisions = new Map(dirty.get());
      return {
        revisions,
        documents: [...revisions.keys()].flatMap((url) => {
          const document = catalog.get(url);
          return document ? [document] : [];
        }),
      };
    },
    complete(batch: Batch) {
      const next = new Map(dirty.get());
      for (const [url, revision] of batch.revisions) {
        // An edit during an upload belongs to the next batch, even if this one succeeded.
        if (next.get(url) === revision) next.delete(url);
      }
      dirty.set(next);
    },
    dispose() {
      repo.off("document", attach);
      repo.off("delete-document", deleted);
      window.removeEventListener("drawing-catalog-change", catalogChanged);
      for (const unsubscribe of subscriptions.values()) unsubscribe();
      subscriptions.clear();
    },
  };
}
