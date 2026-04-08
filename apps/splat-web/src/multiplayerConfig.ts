export interface BrowserLocationLike {
  origin: string;
  protocol: string;
  hostname: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
}

export interface BrowserMultiplayerConfig {
  syncServerHttpUrl: string;
  syncServerWebSocketUrl: string;
  joinBaseUrl: string;
  deviceTag: string;
}

export function createBrowserMultiplayerConfig(
  location: BrowserLocationLike,
  storage: StorageLike = localStorage,
  cryptoImpl: CryptoLike | undefined = globalThis.crypto,
): BrowserMultiplayerConfig {
  const httpProtocol = location.protocol === "https:" ? "https:" : "http:";
  const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
  const apiOrigin = `${httpProtocol}//${location.hostname}:3030`;
  const websocketOrigin = `${wsProtocol}//${location.hostname}:3030`;

  return {
    syncServerHttpUrl: `${apiOrigin}/api`,
    syncServerWebSocketUrl: websocketOrigin,
    joinBaseUrl: location.origin,
    deviceTag: getOrCreateDeviceTag(storage, cryptoImpl),
  };
}

const DEVICE_TAG_STORAGE_KEY = "kids-draw-device-tag";

function getOrCreateDeviceTag(
  storage: StorageLike,
  cryptoImpl: CryptoLike | undefined,
): string {
  const existing = storage.getItem(DEVICE_TAG_STORAGE_KEY);
  if (existing && existing.length > 0) {
    return existing;
  }
  const next = generateDeviceTag(cryptoImpl);
  storage.setItem(DEVICE_TAG_STORAGE_KEY, next);
  return next;
}

function generateDeviceTag(cryptoImpl: CryptoLike | undefined): string {
  if (typeof cryptoImpl?.randomUUID === "function") {
    return cryptoImpl.randomUUID();
  }
  if (typeof cryptoImpl?.getRandomValues === "function") {
    const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }
  return `device-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}
