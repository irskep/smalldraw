import { describe, expect, test } from "bun:test";
import {
  getToolbarUiStorageKeyForDocument,
  loadPersistedToolbarUiState,
  savePersistedToolbarUiState,
} from "../ui/stores/toolbarUiStore";

describe("toolbarUiStore persistence helpers", () => {
  const docUrl = "automerge:test-doc";
  const storageKey = getToolbarUiStorageKeyForDocument(docUrl);

  test("saves and loads valid v1 payload", () => {
    localStorage.clear();

    savePersistedToolbarUiState(docUrl, {
      version: 1,
      activeToolId: "tool.pen",
      strokeColor: "#2e86ff",
      strokeWidth: 24,
    });

    expect(loadPersistedToolbarUiState(docUrl)).toEqual({
      version: 1,
      activeToolId: "tool.pen",
      strokeColor: "#2e86ff",
      strokeWidth: 24,
    });
  });

  test("returns null for invalid JSON payload", () => {
    localStorage.clear();
    localStorage.setItem(storageKey, "{invalid json");

    expect(loadPersistedToolbarUiState(docUrl)).toBeNull();
  });

  test("returns null for schema mismatch", () => {
    localStorage.clear();
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 2,
        activeToolId: "tool.pen",
        strokeColor: "#000000",
        strokeWidth: 8,
      }),
    );
    expect(loadPersistedToolbarUiState(docUrl)).toBeNull();

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        activeToolId: 42,
        strokeColor: "#000000",
        strokeWidth: 8,
      }),
    );
    expect(loadPersistedToolbarUiState(docUrl)).toBeNull();
  });
});
