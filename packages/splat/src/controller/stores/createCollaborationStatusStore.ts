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
      state: "online" | "offline" | "error";
      label:
        | "Collab drawing (online)"
        | "Collab drawing (offline)"
        | "Collab drawing (sync issue)";
      docUrl: string;
      collabDocUrl: string;
      message?: string;
    };

export type CollaborationStatusStore = ReturnType<
  typeof createCollaborationStatusStore
>;

export function createCollaborationStatusStore() {
  const $currentDocument = atom<KidsDocumentSummary | null>(null);
  const $websocketConnected = atom(false);
  const $syncErrorMessage = atom<string | null>(null);
  const $status = computed(
    [$currentDocument, $websocketConnected, $syncErrorMessage],
    (currentDocument, websocketConnected, syncErrorMessage): CollaborationStatus => {
      if (!isCollaborativeDocument(currentDocument)) {
        return { visible: false };
      }
      if (syncErrorMessage) {
        return {
          visible: true,
          state: "error",
          label: "Collab drawing (sync issue)",
          docUrl: currentDocument.docUrl,
          collabDocUrl: currentDocument.collabDocUrl,
          message: syncErrorMessage,
        };
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
      $syncErrorMessage.set(null);
    },
    setWebsocketConnected(websocketConnected: boolean): void {
      if ($websocketConnected.get() === websocketConnected) {
        return;
      }
      $websocketConnected.set(websocketConnected);
      if (websocketConnected) {
        $syncErrorMessage.set(null);
      }
    },
    setSyncError(message: string | null): void {
      const nextMessage = message?.trim() ? message.trim() : null;
      if ($syncErrorMessage.get() === nextMessage) {
        return;
      }
      $syncErrorMessage.set(nextMessage);
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
