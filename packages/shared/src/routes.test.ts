import { describe, expect, test } from "bun:test";

import {
  buildDrawingAppRedirectPath,
  buildDrawingAppUrl,
  DRAW_APP_PATH,
  isPortalRoutePath,
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
    ).toBe("http://localhost:3000/draw/new");
    expect(
      buildDrawingAppUrl("http://localhost:3000", {
        type: "account",
        documentId: "doc with spaces",
      }),
    ).toBe("http://localhost:3000/draw/doc%20with%20spaces");
    expect(
      buildDrawingAppUrl("http://localhost:3000", {
        type: "local",
        docUrl: "automerge:local",
      }),
    ).toBe("http://localhost:3000/draw/local");
    expect(
      buildDrawingAppUrl("http://localhost:3000", {
        type: "join",
        joinSecret: "abc 123",
      }),
    ).toBe("http://localhost:3000/draw/shared/abc%20123");
  });

  test("builds same-origin auth redirect paths", () => {
    expect(
      buildDrawingAppRedirectPath("http://localhost:3000/draw/?doc=server-doc"),
    ).toBe("/draw/?doc=server-doc");
  });
});

describe("portal route helpers", () => {
  test("matches portal routes served by the production server", () => {
    expect(isPortalRoutePath("/")).toBe(true);
    expect(isPortalRoutePath("/account")).toBe(true);
    expect(isPortalRoutePath("/admin")).toBe(true);
    expect(isPortalRoutePath("/login")).toBe(true);
    expect(isPortalRoutePath("/register")).toBe(true);
    expect(isPortalRoutePath("/data")).toBe(true);
    expect(isPortalRoutePath("/privacy")).toBe(true);
    expect(isPortalRoutePath("/terms")).toBe(true);
    expect(isPortalRoutePath("/drawings/deleted")).toBe(true);
    expect(isPortalRoutePath("/invitation/example-token")).toBe(true);
  });

  test("does not match drawing app, API, asset, or unknown routes", () => {
    expect(isPortalRoutePath("/draw/")).toBe(false);
    expect(isPortalRoutePath("/api/v1/documents")).toBe(false);
    expect(isPortalRoutePath("/_bun/client/index.js")).toBe(false);
    expect(isPortalRoutePath("/missing")).toBe(false);
  });
});

test("coloring entry retains account intent", () => {
  const url = new URL(
    buildDrawingAppUrl("https://splatterboard.app/draw/", {
      type: "new",
      coloring: true,
      account: true,
    }),
  );
  expect(url.searchParams.get("picker")).toBe("coloring");
  expect(url.searchParams.get("account")).toBe("1");
});

test("coloring gallery is public and links to a fresh selected drawing", () => {
  expect(isPortalRoutePath("/coloringbook/")).toBe(true);
  const url = new URL(
    buildDrawingAppUrl("https://splatterboard.app", {
      type: "new",
      coloringPageId: "coloring/pavelkukov/dove.svg",
    }),
  );
  expect(url.pathname).toBe("/draw/new");
  expect(url.searchParams.has("new")).toBe(false);
  expect(url.searchParams.get("page")).toBe("coloring/pavelkukov/dove.svg");
});

import { parseDrawingAppUrl, type DrawingRouteIntent } from "./drawingRoutes";

test.each([
  ["/draw/", { kind: "open-last-local" }],
  ["/draw/new", { kind: "create-new-document" }],
  [
    "/draw/new?page=animals-bird",
    { kind: "create-new-document", coloringPageId: "animals-bird" },
  ],
  [
    "/draw/new?picker=coloring",
    { kind: "create-new-document", picker: "coloring" },
  ],
  ["/draw/abc123", { kind: "open-document", documentId: "abc123" }],
  ["/draw/shared/secret", { kind: "open-share-link", joinSecret: "secret" }],
  [
    "/draw/?local=automerge%3Aabc123",
    { kind: "open-local-document", docUrl: "automerge:abc123" },
  ],
  [
    "/draw/?local=catalog-collab%3Aabc123",
    { kind: "open-local-document", docUrl: "catalog-collab:abc123" },
  ],
  [
    "/draw/?doc=abc123",
    { kind: "open-account-document", documentId: "abc123" },
  ],
  ["/draw/?join=secret", { kind: "open-share-link", joinSecret: "secret" }],
  [
    "/draw/?new=coloring&page=animals-bird",
    { kind: "create-new-document", coloringPageId: "animals-bird" },
  ],
] satisfies [string, DrawingRouteIntent][])(
  "parses clean and existing links: %s",
  (href, intent) => {
    expect(parseDrawingAppUrl(href as string)).toEqual(intent);
  },
);

test.each([
  "/draw/a/b",
  "/draw/shared",
  "/draw/%FF",
  "/draw/abc?doc=other",
  "/draw/?local=a&doc=b",
  "/draw/?join=",
  "/draw/automerge%3Aabc",
])("rejects ambiguous or malformed address: %s", (href) => {
  expect(parseDrawingAppUrl(href).kind).toBe("startup-error");
});

test("builds from deep routes without appending to the current document", () => {
  for (const current of [
    "/draw/abc",
    "/draw/shared/secret",
    "/draw/new",
    "/draw/?local=old",
  ]) {
    expect(
      buildDrawingAppUrl(`https://example.com${current}`, {
        type: "local",
        docUrl: "catalog-collab:next",
      }),
    ).toBe("https://example.com/draw/next");
  }
});
