import { atom, computed } from "nanostores";
import {
  isCollaborativeDocument,
  type KidsDocumentSummary,
} from "../../documents";

export type CollaborationStatus =
  | {
      visible: false;
    }
  | {
      visible: true;
      state: "online" | "offline";
      label: "Collab drawing (online)" | "Collab drawing (offline)";
      docUrl: string;
      collabDocUrl: string;
    };

export type CollaborationStatusStore = ReturnType<
  typeof createCollaborationStatusStore
>;

export function createCollaborationStatusStore() {
  const $currentDocument = atom<KidsDocumentSummary | null>(null);
  const $websocketConnected = atom(false);
  const $status = computed(
    [$currentDocument, $websocketConnected],
    (currentDocument, websocketConnected): CollaborationStatus => {
      if (!isCollaborativeDocument(currentDocument)) {
        return { visible: false };
      }
      return websocketConnected
        ? {
            visible: true,
            state: "online",
            label: "Collab drawing (online)",
            docUrl: currentDocument.docUrl,
            collabDocUrl: currentDocument.collabDocUrl,
          }
        : {
            visible: true,
            state: "offline",
            label: "Collab drawing (offline)",
            docUrl: currentDocument.docUrl,
            collabDocUrl: currentDocument.collabDocUrl,
          };
    },
  );

  return {
    $status,
    subscribe(listener: (status: CollaborationStatus) => void): () => void {
      return $status.subscribe(listener);
    },
    getStatus(): CollaborationStatus {
      return $status.get();
    },
    setCurrentDocument(summary: KidsDocumentSummary | null): void {
      if (isSameDocumentSummary($currentDocument.get(), summary)) {
        return;
      }
      $currentDocument.set(summary);
    },
    setWebsocketConnected(websocketConnected: boolean): void {
      if ($websocketConnected.get() === websocketConnected) {
        return;
      }
      $websocketConnected.set(websocketConnected);
    },
  };
}

function isSameDocumentSummary(
  a: KidsDocumentSummary | null,
  b: KidsDocumentSummary | null,
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.docUrl === b.docUrl &&
    a.collaborative === b.collaborative &&
    a.collabDocUrl === b.collabDocUrl
  );
}
