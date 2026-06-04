import { describe, expect, test } from "bun:test";
import {
  buildDrawingAppRedirectPath,
  buildDrawingAppUrl,
  DRAW_APP_PATH,
  resolveDrawingAppBaseUrl,
} from "./index";

describe("drawing app route helpers", () => {
  test("defines the canonical drawing app path", () => {
    expect(DRAW_APP_PATH).toBe("/draw/");
  });

  test("normalizes root origins to the drawing app base URL", () => {
    expect(resolveDrawingAppBaseUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/draw/",
    );
    expect(resolveDrawingAppBaseUrl("https://splatterboard.app/")).toBe(
      "https://splatterboard.app/draw/",
    );
  });

  test("preserves explicit routed drawing app base URLs", () => {
    expect(resolveDrawingAppBaseUrl("https://example.com/draw")).toBe(
      "https://example.com/draw/",
    );
  });

  test("builds account, local, and join drawing URLs", () => {
    expect(
      buildDrawingAppUrl("http://localhost:3000", {
        type: "account",
        documentId: "doc with spaces",
      }),
    ).toBe("http://localhost:3000/draw/?doc=doc+with+spaces");
    expect(
      buildDrawingAppUrl("http://localhost:3000", {
        type: "local",
        docUrl: "automerge:local",
      }),
    ).toBe("http://localhost:3000/draw/?local=automerge%3Alocal");
    expect(
      buildDrawingAppUrl("http://localhost:3000", {
        type: "join",
        joinSecret: "abc 123",
      }),
    ).toBe("http://localhost:3000/draw/?join=abc+123");
  });

  test("builds same-origin auth redirect paths", () => {
    expect(
      buildDrawingAppRedirectPath("http://localhost:3000/draw/?doc=server-doc"),
    ).toBe("/draw/?doc=server-doc");
  });
});
