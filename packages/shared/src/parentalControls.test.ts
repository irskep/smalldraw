import { describe, expect, test } from "bun:test";
import {
  applyParentalControlsSettingsResult,
  clearParentalControlsPin,
  createParentalControlsAccessOptions,
  DEFAULT_PARENTAL_CONTROLS_STATE,
  hasParentalControlsPin,
  isCorrectParentalControlsMathAnswer,
  loadParentalControlsState,
  openParentalControlsSettings,
  PARENTAL_CONTROLS_STORAGE_KEY,
  type ParentalControlsStorageLike,
  setParentalControlsPin,
  setParentalControlsShareMode,
  setParentalControlsSyncNewDrawingsByDefault,
  verifyParentalControlsPin,
} from "./parentalControls";

describe("parental controls storage", () => {
  test("loads defaults for empty or invalid storage", () => {
    const storage = createMemoryStorage();
    expect(loadParentalControlsState(storage)).toEqual(
      DEFAULT_PARENTAL_CONTROLS_STATE,
    );

    storage.setItem(PARENTAL_CONTROLS_STORAGE_KEY, "nope");
    expect(loadParentalControlsState(storage)).toEqual(
      DEFAULT_PARENTAL_CONTROLS_STATE,
    );
  });

  test("stores share mode", () => {
    const storage = createMemoryStorage();

    setParentalControlsShareMode("private_sync", storage);

    expect(loadParentalControlsState(storage)).toMatchObject({
      shareMode: "private_sync",
    });
  });

  test("stores sync-new-drawings default", () => {
    const storage = createMemoryStorage();

    setParentalControlsSyncNewDrawingsByDefault(true, storage);

    expect(loadParentalControlsState(storage)).toMatchObject({
      syncNewDrawingsByDefault: true,
    });
  });

  test("sets, verifies, and clears a PIN", async () => {
    const storage = createMemoryStorage();

    const stateWithPin = await setParentalControlsPin(" 1234 ", storage);
    expect(hasParentalControlsPin(stateWithPin)).toBeTrue();
    expect(await verifyParentalControlsPin("1234", stateWithPin)).toBeTrue();
    expect(await verifyParentalControlsPin("9999", stateWithPin)).toBeFalse();

    const cleared = clearParentalControlsPin(storage);
    expect(hasParentalControlsPin(cleared)).toBeFalse();
  });

  test("builds dialog access options from current storage", async () => {
    const storage = createMemoryStorage();
    await setParentalControlsPin("1234", storage);

    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    try {
      const options = createParentalControlsAccessOptions();
      expect(options.initialState).toEqual({
        hasPin: true,
        shareMode: "allowed",
        syncNewDrawingsByDefault: false,
      });
      expect(await options.verifyPin("1234")).toBeTrue();
      expect(options.isCorrectMathAnswer("30")).toBeTrue();
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  test("applies dialog settings result", async () => {
    const storage = createMemoryStorage();
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    try {
      await applyParentalControlsSettingsResult({
        shareMode: "pin_required",
        syncNewDrawingsByDefault: true,
        pinChange: { type: "set", pin: "2468" },
      });

      const state = loadParentalControlsState(storage);
      expect(state.shareMode).toBe("pin_required");
      expect(state.syncNewDrawingsByDefault).toBeTrue();
      expect(await verifyParentalControlsPin("2468", state)).toBeTrue();
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  test("opens dialog and applies accepted settings", async () => {
    const storage = createMemoryStorage();
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    try {
      const opened = await openParentalControlsSettings({
        async show(options) {
          expect(options.initialState).toEqual({
            hasPin: false,
            shareMode: "allowed",
            syncNewDrawingsByDefault: false,
          });
          return {
            shareMode: "private_sync",
            syncNewDrawingsByDefault: true,
            pinChange: { type: "unchanged" },
          };
        },
        async requestAccess() {
          return false;
        },
      });

      expect(opened).toBeTrue();
      expect(loadParentalControlsState(storage)).toMatchObject({
        shareMode: "private_sync",
        syncNewDrawingsByDefault: true,
      });
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  test("checks the math prompt answer", () => {
    expect(isCorrectParentalControlsMathAnswer("30")).toBeTrue();
    expect(isCorrectParentalControlsMathAnswer(" 30 ")).toBeTrue();
    expect(isCorrectParentalControlsMathAnswer("31")).toBeFalse();
  });
});

function createMemoryStorage(): ParentalControlsStorageLike {
  const entries = new Map<string, string>();
  return {
    getItem(key) {
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      entries.set(key, value);
    },
    removeItem(key) {
      entries.delete(key);
    },
  };
}
