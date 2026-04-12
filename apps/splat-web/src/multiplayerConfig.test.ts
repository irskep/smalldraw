import { describe, expect, test } from "bun:test";
import {
  createBrowserMultiplayerConfig,
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
});

describe("resolveStartupOpenParams", () => {
  test("parses share links and account document links", () => {
    expect(resolveStartupOpenParams("?join=share-token")).toEqual({
      joinSecret: "share-token",
      accountDocumentId: undefined,
    });
    expect(resolveStartupOpenParams("?doc=document-id")).toEqual({
      joinSecret: undefined,
      accountDocumentId: "document-id",
    });
  });

  test("rejects ambiguous startup URLs", () => {
    expect(() => resolveStartupOpenParams("?join=share&doc=document")).toThrow(
      "Open either a share link or an account document, not both.",
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
