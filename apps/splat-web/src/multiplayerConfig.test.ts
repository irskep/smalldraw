import { describe, expect, test } from "bun:test";
import {
  createBrowserMultiplayerConfig,
  resolveSplatStartupIntent,
  resolveStartupOpenParams,
} from "./multiplayerConfig";

describe("createBrowserMultiplayerConfig", () => {
  test("uses the active browser origin for join links and API host", () => {
    const storage = createMemoryStorage();
    expect(
      createBrowserMultiplayerConfig(
        {
          origin: "http://192.168.1.25:3000",
          protocol: "http:",
          hostname: "192.168.1.25",
        },
        storage,
        {
          randomUUID: () => "device-uuid-1",
        },
      ),
    ).toEqual({
      syncServerHttpUrl: "http://192.168.1.25:3030/api",
      syncServerWebSocketUrl: "ws://192.168.1.25:3030",
      joinBaseUrl: "http://192.168.1.25:3000",
      deviceTag: "device-uuid-1",
    });
  });

  test("uses secure protocols when served over https", () => {
    const storage = createMemoryStorage();
    expect(
      createBrowserMultiplayerConfig(
        {
          origin: "https://splatterboard.app",
          protocol: "https:",
          hostname: "splatterboard.app",
        },
        storage,
        {
          randomUUID: () => "device-uuid-2",
        },
      ),
    ).toEqual({
      syncServerHttpUrl: "https://splatterboard.app:3030/api",
      syncServerWebSocketUrl: "wss://splatterboard.app:3030",
      joinBaseUrl: "https://splatterboard.app",
      deviceTag: "device-uuid-2",
    });
  });

  test("reuses stored device tag before generating a new one", () => {
    const storage = createMemoryStorage({
      "kids-draw-device-tag": "stored-device-tag",
    });
    expect(
      createBrowserMultiplayerConfig(
        {
          origin: "http://localhost:3000",
          protocol: "http:",
          hostname: "localhost",
        },
        storage,
        {},
      ).deviceTag,
    ).toBe("stored-device-tag");
  });

  test("falls back when randomUUID is unavailable", () => {
    const storage = createMemoryStorage();
    const config = createBrowserMultiplayerConfig(
      {
        origin: "http://localhost:3000",
        protocol: "http:",
        hostname: "localhost",
      },
      storage,
      {
        getRandomValues(array) {
          const target = array as Uint8Array;
          for (let i = 0; i < target.length; i++) {
            target[i] = i;
          }
          return array;
        },
      },
    );
    expect(config.deviceTag).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  test("maps Vite env names into domain runtime config", () => {
    const storage = createMemoryStorage();
    expect(
      createBrowserMultiplayerConfig(
        {
          origin: "http://localhost:3000",
          protocol: "http:",
          hostname: "localhost",
        },
        storage,
        {
          randomUUID: () => "device-uuid-3",
        },
        {
          VITE_SYNC_SERVER_HTTP_URL: "https://api.example.com/api/",
          VITE_SYNC_SERVER_WEBSOCKET_URL: "wss://api.example.com/",
          VITE_JOIN_BASE_URL: "https://draw.example.com/",
        },
      ),
    ).toEqual({
      syncServerHttpUrl: "https://api.example.com/api",
      syncServerWebSocketUrl: "wss://api.example.com",
      joinBaseUrl: "https://draw.example.com",
      deviceTag: "device-uuid-3",
    });
  });
});

describe("resolveStartupOpenParams", () => {
  test("parses share, account, and local document links", () => {
    expect(resolveStartupOpenParams("?join=share-token")).toEqual({
      joinSecret: "share-token",
      accountDocumentId: undefined,
      localDocUrl: undefined,
    });
    expect(resolveStartupOpenParams("?doc=document-id")).toEqual({
      joinSecret: undefined,
      accountDocumentId: "document-id",
      localDocUrl: undefined,
    });
    expect(resolveStartupOpenParams("?local=automerge%3Alocal-doc")).toEqual({
      joinSecret: undefined,
      accountDocumentId: undefined,
      localDocUrl: "automerge:local-doc",
    });
  });

  test("rejects ambiguous startup URLs", () => {
    expect(() => resolveStartupOpenParams("?join=share&doc=document")).toThrow(
      "Open only one drawing URL at a time.",
    );
  });
});

describe("resolveSplatStartupIntent", () => {
  test("returns one discrete startup intent", () => {
    expect(resolveSplatStartupIntent("")).toEqual({
      kind: "open-last-local",
    });
    expect(resolveSplatStartupIntent("?join=share-token")).toEqual({
      kind: "open-share-link",
      joinSecret: "share-token",
    });
    expect(resolveSplatStartupIntent("?doc=document-id")).toEqual({
      kind: "open-account-document",
      documentId: "document-id",
    });
    expect(resolveSplatStartupIntent("?local=automerge%3Alocal-doc")).toEqual({
      kind: "open-local-document",
      docUrl: "automerge:local-doc",
    });
  });

  test("represents invalid startup query as data", () => {
    expect(resolveSplatStartupIntent("?join=share&doc=document")).toEqual({
      kind: "startup-error",
      message: "Open only one drawing URL at a time.",
    });
  });
});

function createMemoryStorage(seed?: Record<string, string>) {
  const values = new Map(Object.entries(seed ?? {}));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}
