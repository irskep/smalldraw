import {
  savePersistedToolbarUiState,
  type PersistedKidsUiStateV1,
  type ToolbarUiState,
  type ToolbarUiStore,
} from "./toolbarUiStore";

type PendingWrite = {
  docUrl: string;
  state: PersistedKidsUiStateV1;
  signature: string;
};

export interface ToolbarUiPersistence {
  start(): void;
  stop(): void;
  flush(): void;
}

export const DEFAULT_UI_STATE_PERSIST_DEBOUNCE_MS = 150;

export function getToolbarUiPersistSignature(
  state: PersistedKidsUiStateV1,
): string {
  return `${state.activeToolId}|${state.strokeColor}|${state.strokeWidth}`;
}

export function toPersistedToolbarUiState(
  state: Pick<ToolbarUiState, "activeToolId" | "strokeColor" | "strokeWidth">,
): PersistedKidsUiStateV1 {
  return {
    version: 1,
    activeToolId: state.activeToolId,
    strokeColor: state.strokeColor,
    strokeWidth: state.strokeWidth,
  };
}

export function createToolbarUiPersistence(options: {
  toolbarUiStore: ToolbarUiStore;
  getCurrentDocUrl: () => string;
  debounceMs?: number;
  seedPersistedSignature?: (docUrl: string, signature: string) => void;
}): ToolbarUiPersistence {
  const debounceMs = options.debounceMs ?? DEFAULT_UI_STATE_PERSIST_DEBOUNCE_MS;
  const savedSignatureByDocUrl = new Map<string, string>();
  const seedPersistedSignature = (
    docUrl: string,
    signature: string,
  ): void => {
    savedSignatureByDocUrl.set(docUrl, signature);
    options.seedPersistedSignature?.(docUrl, signature);
  };

  let pendingWrite: PendingWrite | null = null;
  let writeTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;

  const flush = (): void => {
    if (!pendingWrite) {
      return;
    }
    savePersistedToolbarUiState(pendingWrite.docUrl, pendingWrite.state);
    seedPersistedSignature(pendingWrite.docUrl, pendingWrite.signature);
    pendingWrite = null;
  };

  const queueWrite = (
    docUrl: string,
    state: PersistedKidsUiStateV1,
    signature: string,
  ): void => {
    if (savedSignatureByDocUrl.get(docUrl) === signature) {
      return;
    }
    if (
      pendingWrite &&
      pendingWrite.docUrl === docUrl &&
      pendingWrite.signature === signature
    ) {
      return;
    }
    pendingWrite = { docUrl, state, signature };
    if (writeTimeoutHandle !== null) {
      clearTimeout(writeTimeoutHandle);
    }
    writeTimeoutHandle = setTimeout(() => {
      writeTimeoutHandle = null;
      flush();
    }, debounceMs);
  };

  const stop = (): void => {
    unsubscribe?.();
    unsubscribe = null;
    if (writeTimeoutHandle !== null) {
      clearTimeout(writeTimeoutHandle);
      writeTimeoutHandle = null;
    }
  };

  return {
    start(): void {
      stop();
      const docUrl = options.getCurrentDocUrl();
      const signature = getToolbarUiPersistSignature(
        toPersistedToolbarUiState(options.toolbarUiStore.get()),
      );
      seedPersistedSignature(docUrl, signature);
      unsubscribe = options.toolbarUiStore.subscribe((state) => {
        const docUrl = options.getCurrentDocUrl();
        const persistedState = toPersistedToolbarUiState(state);
        const signature = getToolbarUiPersistSignature(persistedState);
        queueWrite(docUrl, persistedState, signature);
      });
    },
    stop,
    flush,
  };
}
