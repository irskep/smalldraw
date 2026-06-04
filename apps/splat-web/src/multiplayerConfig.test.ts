import { describe, expect, test } from "bun:test";
import {
  createBrowserMultiplayerConfig,
  resolveSplatStartupIntent,
  resolveStartupOpenParams,
} from "./multiplayerConfig";

describe("createBrowserMultiplayerConfig", () => {
  const configuredEnv = {
    SPLATTERBOARD_PUBLIC_SYNC_SERVER_HTTP_URL: "http://192.168.1.25:3030/api",
    SPLATTERBOARD_PUBLIC_SYNC_SERVER_WEBSOCKET_URL: "ws://192.168.1.25:3030",
    SPLATTERBOARD_PUBLIC_JOIN_BASE_URL: "http://192.168.1.25:3000",
    SPLATTERBOARD_PUBLIC_ASSET_BASE_URL: "http://192.168.1.25:3030",
  };

  test("uses env vars", () => {
    const storage = createMemoryStorage();
    expect(
      createBrowserMultiplayerConfig(
        storage,
        { randomUUID: () => "device-uuid-1" },
        configuredEnv,
      ),
    ).toEqual({
      syncServerHttpUrl: "http://192.168.1.25:3030/api",
      syncServerWebSocketUrl: "ws://192.168.1.25:3030",
      joinBaseUrl: "http://192.168.1.25:3000/draw/",
      assetBaseUrl: "http://192.168.1.25:3030",
      deviceTag: "device-uuid-1",
    });
  });

  test("strips trailing slashes from configured urls", () => {
    const storage = createMemoryStorage();
    expect(
      createBrowserMultiplayerConfig(
        storage,
        { randomUUID: () => "device-uuid-2" },
        {
          SPLATTERBOARD_PUBLIC_SYNC_SERVER_HTTP_URL:
            "https://api.splatterboard.app/api/",
          SPLATTERBOARD_PUBLIC_SYNC_SERVER_WEBSOCKET_URL:
            "wss://sync.splatterboard.app/",
          SPLATTERBOARD_PUBLIC_JOIN_BASE_URL: "https://splatterboard.app/",
          SPLATTERBOARD_PUBLIC_ASSET_BASE_URL:
            "https://assets.splatterboard.app/",
        },
      ),
    ).toEqual({
      syncServerHttpUrl: "https://api.splatterboard.app/api",
      syncServerWebSocketUrl: "wss://sync.splatterboard.app",
      joinBaseUrl: "https://splatterboard.app/draw/",
      assetBaseUrl: "https://assets.splatterboard.app",
      deviceTag: "device-uuid-2",
    });
  });

  test("reuses stored device tag before generating a new one", () => {
    const storage = createMemoryStorage({
      "kids-draw-device-tag": "stored-device-tag",
    });
    expect(
      createBrowserMultiplayerConfig(storage, {}, configuredEnv).deviceTag,
    ).toBe("stored-device-tag");
  });

  test("falls back when randomUUID is unavailable", () => {
    const storage = createMemoryStorage();
    const config = createBrowserMultiplayerConfig(
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
      configuredEnv,
    );
    expect(config.deviceTag).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
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
    expect(resolveStartupOpenParams("?new=1")).toEqual({
      createNew: true,
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
    expect(resolveSplatStartupIntent("?new=1")).toEqual({
      kind: "create-new-document",
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
    expect(resolveSplatStartupIntent("?new=1&local=automerge%3Alocal")).toEqual(
      {
        kind: "startup-error",
        message: "Open only one drawing URL at a time.",
      },
    );
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
