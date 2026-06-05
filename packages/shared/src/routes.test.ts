import { describe, expect, test } from "bun:test";
import {
  buildDrawingAppRedirectPath,
  buildDrawingAppUrl,
  DRAW_APP_PATH,
  isAccountAppRoutePath,
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

  test("builds new, account, local, and join drawing URLs", () => {
    expect(
      buildDrawingAppUrl("http://localhost:3000", {
        type: "new",
      }),
    ).toBe("http://localhost:3000/draw/?new=1");
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

describe("account app route helpers", () => {
  test("matches account app routes served by the production server", () => {
    expect(isAccountAppRoutePath("/")).toBe(true);
    expect(isAccountAppRoutePath("/login")).toBe(true);
    expect(isAccountAppRoutePath("/register")).toBe(true);
    expect(isAccountAppRoutePath("/drawings/deleted")).toBe(true);
    expect(isAccountAppRoutePath("/invitation/example-token")).toBe(true);
  });

  test("does not match drawing app, API, asset, or unknown routes", () => {
    expect(isAccountAppRoutePath("/draw/")).toBe(false);
    expect(isAccountAppRoutePath("/api/v1/documents")).toBe(false);
    expect(isAccountAppRoutePath("/_bun/client/index.js")).toBe(false);
    expect(isAccountAppRoutePath("/missing")).toBe(false);
  });
});
