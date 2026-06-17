export const PARENTAL_CONTROLS_STORAGE_KEY = "smalldraw:parental-controls:v1";

const PARENTAL_CONTROLS_EVENT = "smalldraw:parental-controls-change";
const PIN_SALT_BYTES = 16;

export type ParentalControlsState = {
  version: 1;
  promptSeen: boolean;
  sharingHidden: boolean;
  pinHash?: string;
  pinSalt?: string;
};

export type ParentalControlsSettingsResult = {
  sharingHidden: boolean;
  pinChange:
    | { type: "unchanged" }
    | { type: "set"; pin: string }
    | { type: "clear" };
};

export type ParentalControlsAccessOptions = {
  initialState: {
    hasPin: boolean;
    sharingHidden: boolean;
  };
  verifyPin: (pin: string) => Promise<boolean>;
  isCorrectMathAnswer: (answer: string) => boolean;
};

export type ParentalControlsDialogLike = {
  show(
    options: ParentalControlsAccessOptions,
  ): Promise<ParentalControlsSettingsResult | null>;
};

export type ParentalControlsStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type ParentalControlsStorageEventLike = {
  key?: string | null;
};

type ParentalControlsRuntimeLike = {
  localStorage?: ParentalControlsStorageLike;
  addEventListener?: (
    type: string,
    listener: (event: ParentalControlsStorageEventLike) => void,
  ) => void;
  removeEventListener?: (
    type: string,
    listener: (event: ParentalControlsStorageEventLike) => void,
  ) => void;
  dispatchEvent?: (event: unknown) => void;
  Event?: new (type: string) => unknown;
  crypto?: {
    getRandomValues<T extends ArrayBufferView>(array: T): T;
    subtle: {
      digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
    };
  };
};

export const DEFAULT_PARENTAL_CONTROLS_STATE: ParentalControlsState =
  Object.freeze({
    version: 1,
    promptSeen: false,
    sharingHidden: false,
  });

export function loadParentalControlsState(
  storage: ParentalControlsStorageLike | undefined = getLocalStorage(),
): ParentalControlsState {
  if (!storage) {
    return { ...DEFAULT_PARENTAL_CONTROLS_STATE };
  }
  try {
    const raw = storage.getItem(PARENTAL_CONTROLS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PARENTAL_CONTROLS_STATE };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isParentalControlsState(parsed)) {
      return { ...DEFAULT_PARENTAL_CONTROLS_STATE };
    }
    return parsed;
  } catch {
    return { ...DEFAULT_PARENTAL_CONTROLS_STATE };
  }
}

export function saveParentalControlsState(
  state: ParentalControlsState,
  storage: ParentalControlsStorageLike | undefined = getLocalStorage(),
): void {
  if (!storage) {
    return;
  }
  storage.setItem(PARENTAL_CONTROLS_STORAGE_KEY, JSON.stringify(state));
  dispatchParentalControlsChange();
}

export function updateParentalControlsState(
  updater: (state: ParentalControlsState) => ParentalControlsState,
  storage: ParentalControlsStorageLike | undefined = getLocalStorage(),
): ParentalControlsState {
  const next = updater(loadParentalControlsState(storage));
  saveParentalControlsState(next, storage);
  return next;
}

export function hasParentalControlsPin(
  state: ParentalControlsState = loadParentalControlsState(),
): boolean {
  return Boolean(state.pinHash && state.pinSalt);
}

export function markParentalControlsPromptSeen(
  storage?: ParentalControlsStorageLike,
): ParentalControlsState {
  return updateParentalControlsState(
    (state) => ({ ...state, promptSeen: true }),
    storage,
  );
}

export function setParentalControlsSharingHidden(
  sharingHidden: boolean,
  storage?: ParentalControlsStorageLike,
): ParentalControlsState {
  return updateParentalControlsState(
    (state) => ({ ...state, sharingHidden }),
    storage,
  );
}

export async function setParentalControlsPin(
  pin: string,
  storage?: ParentalControlsStorageLike,
): Promise<ParentalControlsState> {
  const normalizedPin = normalizePin(pin);
  if (!normalizedPin) {
    throw new Error("PIN is required");
  }
  const pinSalt = createSalt();
  const pinHash = await hashPin(normalizedPin, pinSalt);
  return updateParentalControlsState(
    (state) => ({ ...state, pinHash, pinSalt }),
    storage,
  );
}

export function clearParentalControlsPin(
  storage?: ParentalControlsStorageLike,
): ParentalControlsState {
  return updateParentalControlsState(
    ({ pinHash: _pinHash, pinSalt: _pinSalt, ...state }) => state,
    storage,
  );
}

export async function verifyParentalControlsPin(
  pin: string,
  state: ParentalControlsState = loadParentalControlsState(),
): Promise<boolean> {
  if (!state.pinHash || !state.pinSalt) {
    return false;
  }
  return (await hashPin(normalizePin(pin), state.pinSalt)) === state.pinHash;
}

export function isCorrectParentalControlsMathAnswer(answer: string): boolean {
  return answer.trim() === "30";
}

export function createParentalControlsAccessOptions(): ParentalControlsAccessOptions {
  const state = loadParentalControlsState();
  return {
    initialState: {
      hasPin: hasParentalControlsPin(state),
      sharingHidden: state.sharingHidden,
    },
    verifyPin: async (pin) =>
      await verifyParentalControlsPin(pin, loadParentalControlsState()),
    isCorrectMathAnswer: isCorrectParentalControlsMathAnswer,
  };
}

export async function applyParentalControlsSettingsResult(
  result: ParentalControlsSettingsResult,
): Promise<void> {
  markParentalControlsPromptSeen();
  setParentalControlsSharingHidden(result.sharingHidden);
  if (result.pinChange.type === "set") {
    await setParentalControlsPin(result.pinChange.pin);
  } else if (result.pinChange.type === "clear") {
    clearParentalControlsPin();
  }
}

export async function openParentalControlsSettings(
  dialog: ParentalControlsDialogLike,
): Promise<boolean> {
  const result = await dialog.show(createParentalControlsAccessOptions());
  if (!result) {
    return false;
  }
  await applyParentalControlsSettingsResult(result);
  return true;
}

export function subscribeToParentalControlsState(
  listener: (state: ParentalControlsState) => void,
): () => void {
  const notify = () => listener(loadParentalControlsState());
  const handleStorage = (event: ParentalControlsStorageEventLike) => {
    if (event.key === PARENTAL_CONTROLS_STORAGE_KEY) {
      notify();
    }
  };
  const runtime = getRuntime();
  runtime.addEventListener?.("storage", handleStorage);
  runtime.addEventListener?.(PARENTAL_CONTROLS_EVENT, notify);
  return () => {
    runtime.removeEventListener?.("storage", handleStorage);
    runtime.removeEventListener?.(PARENTAL_CONTROLS_EVENT, notify);
  };
}

function isParentalControlsState(
  value: unknown,
): value is ParentalControlsState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ParentalControlsState>;
  const hasPinHash =
    candidate.pinHash === undefined || typeof candidate.pinHash === "string";
  const hasPinSalt =
    candidate.pinSalt === undefined || typeof candidate.pinSalt === "string";
  return (
    candidate.version === 1 &&
    typeof candidate.promptSeen === "boolean" &&
    typeof candidate.sharingHidden === "boolean" &&
    hasPinHash &&
    hasPinSalt
  );
}

function getLocalStorage(): ParentalControlsStorageLike | undefined {
  try {
    return getRuntime().localStorage;
  } catch {
    return undefined;
  }
}

function normalizePin(pin: string): string {
  return pin.trim();
}

function createSalt(): string {
  const bytes = new Uint8Array(PIN_SALT_BYTES);
  const crypto = requireCrypto();
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const input = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await requireCrypto().subtle.digest("SHA-256", input);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function dispatchParentalControlsChange(): void {
  const runtime = getRuntime();
  if (
    typeof runtime.dispatchEvent !== "function" ||
    typeof runtime.Event !== "function"
  ) {
    return;
  }
  runtime.dispatchEvent(new runtime.Event(PARENTAL_CONTROLS_EVENT));
}

function getRuntime(): ParentalControlsRuntimeLike {
  return globalThis as ParentalControlsRuntimeLike;
}

function requireCrypto(): NonNullable<ParentalControlsRuntimeLike["crypto"]> {
  const crypto = getRuntime().crypto;
  if (!crypto) {
    throw new Error("Crypto is required for parental controls PINs");
  }
  return crypto;
}
