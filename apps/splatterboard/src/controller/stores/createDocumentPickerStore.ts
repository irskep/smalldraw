import { atom } from "nanostores";
import type { KidsDocumentSummary } from "../../documents";

type DocumentPickerState = {
  loading: boolean;
  busyDocUrl: string | null;
  documents: KidsDocumentSummary[];
  thumbnailUrlByDocUrl: Map<string, string>;
};

export function createDocumentPickerStore() {
  const $state = atom<DocumentPickerState>({
    loading: false,
    busyDocUrl: null,
    documents: [],
    thumbnailUrlByDocUrl: new Map(),
  });

  return {
    $state,
    subscribe(listener: (state: DocumentPickerState) => void): () => void {
      return $state.subscribe(listener);
    },
    get(): DocumentPickerState {
      return $state.get();
    },
    setLoading(loading: boolean): void {
      const current = $state.get();
      if (current.loading === loading) {
        return;
      }
      $state.set({ ...current, loading });
    },
    setBusyDocument(busyDocUrl: string | null): void {
      const current = $state.get();
      if (current.busyDocUrl === busyDocUrl) {
        return;
      }
      $state.set({ ...current, busyDocUrl });
    },
    setDocuments(documents: KidsDocumentSummary[]): void {
      const current = $state.get();
      if (isSameDocuments(current.documents, documents)) {
        return;
      }
      $state.set({ ...current, documents: [...documents] });
    },
    setThumbnailUrls(thumbnailUrlByDocUrl: Map<string, string>): void {
      const current = $state.get();
      if (
        isSameThumbnailMap(
          current.thumbnailUrlByDocUrl,
          thumbnailUrlByDocUrl,
        )
      ) {
        return;
      }
      $state.set({
        ...current,
        thumbnailUrlByDocUrl: new Map(thumbnailUrlByDocUrl),
      });
    },
    clearThumbnailUrls(): void {
      const current = $state.get();
      if (current.thumbnailUrlByDocUrl.size === 0) {
        return;
      }
      $state.set({ ...current, thumbnailUrlByDocUrl: new Map() });
    },
  };
}

function isSameDocuments(
  a: readonly KidsDocumentSummary[],
  b: readonly KidsDocumentSummary[],
): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (!isSameDocumentSummary(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

function isSameDocumentSummary(
  a: KidsDocumentSummary,
  b: KidsDocumentSummary,
): boolean {
  return (
    a.docUrl === b.docUrl &&
    a.title === b.title &&
    a.mode === b.mode &&
    a.coloringPageId === b.coloringPageId &&
    a.referenceImageSrc === b.referenceImageSrc &&
    a.referenceComposite === b.referenceComposite &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt &&
    a.lastOpenedAt === b.lastOpenedAt &&
    a.thumbnailKey === b.thumbnailKey
  );
}

function isSameThumbnailMap(
  a: ReadonlyMap<string, string>,
  b: ReadonlyMap<string, string>,
): boolean {
  if (a === b) {
    return true;
  }
  if (a.size !== b.size) {
    return false;
  }
  for (const [key, value] of a) {
    if (b.get(key) !== value) {
      return false;
    }
  }
  return true;
}
