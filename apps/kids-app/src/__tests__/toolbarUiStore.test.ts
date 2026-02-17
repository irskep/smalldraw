import { describe, expect, test } from "bun:test";
import {
  loadPersistedToolbarUiState,
  savePersistedToolbarUiState,
  UI_STATE_STORAGE_KEY,
} from "../ui/stores/toolbarUiStore";

describe("toolbarUiStore persistence helpers", () => {
  test("saves and loads valid v1 payload", () => {
    localStorage.clear();

    savePersistedToolbarUiState({
      version: 1,
      activeToolId: "tool.pen",
      strokeColor: "#2e86ff",
      strokeWidth: 24,
    });

    expect(loadPersistedToolbarUiState()).toEqual({
      version: 1,
      activeToolId: "tool.pen",
      strokeColor: "#2e86ff",
      strokeWidth: 24,
    });
  });

  test("returns null for invalid JSON payload", () => {
    localStorage.clear();
    localStorage.setItem(UI_STATE_STORAGE_KEY, "{invalid json");

    expect(loadPersistedToolbarUiState()).toBeNull();
  });

  test("returns null for schema mismatch", () => {
    localStorage.clear();
    localStorage.setItem(
      UI_STATE_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        activeToolId: "tool.pen",
        strokeColor: "#000000",
        strokeWidth: 8,
      }),
    );
    expect(loadPersistedToolbarUiState()).toBeNull();

    localStorage.setItem(
      UI_STATE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeToolId: 42,
        strokeColor: "#000000",
        strokeWidth: 8,
      }),
    );
    expect(loadPersistedToolbarUiState()).toBeNull();
  });
});
