import { describe, expect, test } from "bun:test";
import { createBrowserMultiplayerConfig } from "./multiplayerConfig";

describe("createBrowserMultiplayerConfig", () => {
  test("uses the active browser origin for join links and API host", () => {
    expect(
      createBrowserMultiplayerConfig({
        origin: "http://192.168.1.25:3000",
        protocol: "http:",
        hostname: "192.168.1.25",
      }),
    ).toEqual({
      syncServerHttpUrl: "http://192.168.1.25:3030/api",
      syncServerWebSocketUrl: "ws://192.168.1.25:3030",
      joinBaseUrl: "http://192.168.1.25:3000",
    });
  });

  test("uses secure protocols when served over https", () => {
    expect(
      createBrowserMultiplayerConfig({
        origin: "https://splatterboard.app",
        protocol: "https:",
        hostname: "splatterboard.app",
      }),
    ).toEqual({
      syncServerHttpUrl: "https://splatterboard.app:3030/api",
      syncServerWebSocketUrl: "wss://splatterboard.app:3030",
      joinBaseUrl: "https://splatterboard.app",
    });
  });
});
