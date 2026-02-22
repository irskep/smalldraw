import { describe, expect, test } from "bun:test";
import { createToolbarUiPersistence } from "../ui/stores/toolbarUiPersistence";
import {
  createToolbarUiStore,
  loadPersistedToolbarUiState,
  type ToolbarUiState,
  type ToolbarUiStore,
} from "../ui/stores/toolbarUiStore";

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function createToolbarUiStoreStub(initialState: ToolbarUiState): {
  toolbarUiStore: ToolbarUiStore;
  setState: (nextState: ToolbarUiState) => void;
} {
  let state = initialState;
  const listeners = new Set<(nextState: ToolbarUiState) => void>();

  return {
    toolbarUiStore: {
      get: () => state,
      subscribe: (listener: (nextState: ToolbarUiState) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    } as unknown as ToolbarUiStore,
    setState: (nextState) => {
      state = nextState;
      for (const listener of listeners) {
        listener(nextState);
      }
    },
  };
}

describe("toolbarUiPersistence", () => {
  test("dedupes unchanged signatures", async () => {
    const docUrl = "automerge:dedupe";
    const toolbarUiStore = createToolbarUiStore();
    const persistedSignatures: string[] = [];
    const persistence = createToolbarUiPersistence({
      toolbarUiStore,
      getCurrentDocUrl: () => docUrl,
      debounceMs: 10,
      seedPersistedSignature: (_doc, signature) =>
        persistedSignatures.push(signature),
    });

    persistence.start();
    toolbarUiStore.setStyleUi("#000000", "#ffffff", 2);
    await wait(20);
    expect(loadPersistedToolbarUiState(docUrl)).toBeNull();
    expect(persistedSignatures.length).toBe(1);

    toolbarUiStore.setStyleUi("#0055ff", "#ffffff", 2);
    await wait(20);
    expect(loadPersistedToolbarUiState(docUrl)).toEqual({
      version: 1,
      activeToolId: "",
      strokeColor: "#0055ff",
      strokeWidth: 2,
    });
    expect(persistedSignatures.length).toBe(2);

    toolbarUiStore.setStyleUi("#0055ff", "#ffffff", 2);
    await wait(20);
    expect(persistedSignatures.length).toBe(2);
  });

  test("debounces rapid updates into one write", async () => {
    const docUrl = "automerge:debounce";
    const toolbarUiStore = createToolbarUiStore();
    const persistedSignatures: string[] = [];
    const persistence = createToolbarUiPersistence({
      toolbarUiStore,
      getCurrentDocUrl: () => docUrl,
      debounceMs: 30,
      seedPersistedSignature: (_doc, signature) =>
        persistedSignatures.push(signature),
    });

    persistence.start();
    toolbarUiStore.setStyleUi("#111111", "#ffffff", 2);
    toolbarUiStore.setStyleUi("#222222", "#ffffff", 16);
    await wait(45);

    expect(persistedSignatures.length).toBe(2);
    expect(loadPersistedToolbarUiState(docUrl)).toEqual({
      version: 1,
      activeToolId: "",
      strokeColor: "#222222",
      strokeWidth: 16,
    });
  });

  test("tracks dedupe signatures per document", async () => {
    let currentDocUrl = "automerge:doc-1";
    const initialState: ToolbarUiState = {
      activeToolId: "",
      activeFamilyId: "",
      canUndo: false,
      canRedo: false,
      strokeColor: "#000000",
      fillColor: "#ffffff",
      strokeWidth: 2,
      supportsStrokeColor: true,
      supportsStrokeWidth: true,
      supportsFillColor: false,
      supportsTransparentStrokeColor: false,
      supportsTransparentFillColor: false,
      newDrawingPending: false,
      mobileTopPanel: "colors",
      mobileActionsOpen: false,
    };
    const changedState: ToolbarUiState = {
      ...initialState,
      strokeColor: "#1188ff",
    };
    const { toolbarUiStore, setState } = createToolbarUiStoreStub(initialState);
    const persistedEvents: Array<{ docUrl: string; signature: string }> = [];
    const persistence = createToolbarUiPersistence({
      toolbarUiStore,
      getCurrentDocUrl: () => currentDocUrl,
      debounceMs: 10,
      seedPersistedSignature: (docUrl, signature) =>
        persistedEvents.push({ docUrl, signature }),
    });

    persistence.start();
    setState(changedState);
    await wait(20);
    expect(loadPersistedToolbarUiState("automerge:doc-1")).toEqual({
      version: 1,
      activeToolId: "",
      strokeColor: "#1188ff",
      strokeWidth: 2,
    });

    currentDocUrl = "automerge:doc-2";
    setState(changedState);
    await wait(20);
    expect(loadPersistedToolbarUiState("automerge:doc-2")).toEqual({
      version: 1,
      activeToolId: "",
      strokeColor: "#1188ff",
      strokeWidth: 2,
    });
    expect(
      persistedEvents.filter((event) => event.docUrl === "automerge:doc-2")
        .length,
    ).toBe(1);
  });

  test("flush writes pending update immediately without duplicate timer write", async () => {
    const docUrl = "automerge:flush";
    const toolbarUiStore = createToolbarUiStore();
    const persistedSignatures: string[] = [];
    const persistence = createToolbarUiPersistence({
      toolbarUiStore,
      getCurrentDocUrl: () => docUrl,
      debounceMs: 80,
      seedPersistedSignature: (_doc, signature) =>
        persistedSignatures.push(signature),
    });

    persistence.start();
    toolbarUiStore.setStyleUi("#000000", "#ffffff", 24);
    persistence.flush();
    expect(loadPersistedToolbarUiState(docUrl)).toEqual({
      version: 1,
      activeToolId: "",
      strokeColor: "#000000",
      strokeWidth: 24,
    });
    expect(persistedSignatures.length).toBe(2);

    await wait(100);
    expect(persistedSignatures.length).toBe(2);
  });
});
