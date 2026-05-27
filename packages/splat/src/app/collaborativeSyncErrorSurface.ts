import type { CollaborationStatus } from "../controller/stores/createCollaborationStatusStore";

const DEFAULT_SYNC_ERROR_MESSAGE =
  "Sync is taking longer than expected. Changes may not be reaching the server. Check your connection and try again.";

type UnhandledRejectionEventLike = Event & {
  reason?: unknown;
  preventDefault(): void;
};

export function bindCollaborativeSyncErrorSurface(options: {
  windowTarget: Pick<Window, "addEventListener" | "removeEventListener">;
  collaborationStatusStore: {
    getStatus(): CollaborationStatus;
    setSyncError(message: string | null): void;
  };
}): () => void {
  const handleUnhandledRejection = (event: Event): void => {
    const status = options.collaborationStatusStore.getStatus();
    if (!status.visible) {
      return;
    }
    const message = resolveCollaborativeSyncIssueMessage(
      (event as UnhandledRejectionEventLike).reason,
    );
    if (!message) {
      return;
    }
    (event as UnhandledRejectionEventLike).preventDefault();
    options.collaborationStatusStore.setSyncError(message);
  };

  options.windowTarget.addEventListener(
    "unhandledrejection",
    handleUnhandledRejection,
  );
  return () => {
    options.windowTarget.removeEventListener(
      "unhandledrejection",
      handleUnhandledRejection,
    );
  };
}

export function resolveCollaborativeSyncIssueMessage(
  reason: unknown,
): string | null {
  const normalized = normalizeReason(reason);
  if (!normalized) {
    return null;
  }
  const { name, message, stack } = normalized;
  const timeoutLike =
    name === "TimeoutError" || message.includes("withTimeout: timed out after");
  const syncLike =
    message.includes("beginSync") ||
    stack.includes("beginSync") ||
    stack.includes("DocSynchronizer") ||
    stack.includes("withTimeout.js");
  if (!timeoutLike || !syncLike) {
    return null;
  }
  return DEFAULT_SYNC_ERROR_MESSAGE;
}

export function isSyncIssueShareMessage(message: string): boolean {
  return (
    message.includes("connecting to collaborative sync") ||
    message.includes("Check server connection and try again")
  );
}

function normalizeReason(
  reason: unknown,
): { name: string; message: string; stack: string } | null {
  if (reason instanceof Error) {
    return {
      name: reason.name,
      message: reason.message.trim(),
      stack: reason.stack ?? "",
    };
  }
  if (!reason || typeof reason !== "object") {
    return null;
  }
  const candidate = reason as {
    name?: unknown;
    message?: unknown;
    stack?: unknown;
  };
  if (typeof candidate.message !== "string") {
    return null;
  }
  return {
    name: typeof candidate.name === "string" ? candidate.name : "",
    message: candidate.message.trim(),
    stack: typeof candidate.stack === "string" ? candidate.stack : "",
  };
}
