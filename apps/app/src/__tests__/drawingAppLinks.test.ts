import { describe, expect, test } from "vitest";
import {
  buildLocalDrawingUrl,
  buildNewDrawingUrl,
  buildDrawingDocumentUrl,
  createAccountWebRuntimeConfig,
  resolveDrawingAppBaseUrl,
} from "../utils/drawingAppLinks";

describe("drawing app links", () => {
  test("maps Vite env names into domain runtime config", () => {
    expect(
      createAccountWebRuntimeConfig(
        {
          VITE_DRAWING_APP_BASE_URL: "https://draw.example.com/",
        },
        {
          protocol: "http:",
          host: "localhost:3000",
        },
      ),
    ).toEqual({
      drawingAppBaseUrl: "https://draw.example.com/draw/",
    });
  });

  test("derives drawing app base URL from portal-web host", () => {
    expect(
      createAccountWebRuntimeConfig(
        {},
        {
          protocol: "http:",
          host: "localhost:3000",
        },
      ),
    ).toEqual({
      drawingAppBaseUrl: "http://localhost:3000/draw/",
    });
    expect(
      resolveDrawingAppBaseUrl({
        protocol: "http:",
        host: "localhost:3000",
      }),
    ).toBe("http://localhost:3000/draw/");
    expect(
      resolveDrawingAppBaseUrl({
        protocol: "http:",
        host: "192.168.1.58:3000",
      }),
    ).toBe("http://192.168.1.58:3000/draw/");
    expect(
      resolveDrawingAppBaseUrl({
        protocol: "https:",
        host: "splatterboard.app",
      }),
    ).toBe("https://splatterboard.app/draw/");
  });

  test("builds canonical drawing app document URL", () => {
    expect(
      buildDrawingDocumentUrl("doc with spaces", {
        drawingAppBaseUrl: "http://localhost:3000/draw/",
      }),
    ).toBe("http://localhost:3000/draw/?doc=doc+with+spaces");
  });

  test("builds explicit new and local drawing URLs", () => {
    expect(
      buildNewDrawingUrl({
        drawingAppBaseUrl: "http://localhost:3000/draw/",
      }),
    ).toBe("http://localhost:3000/draw/?new=1");
    expect(
      buildLocalDrawingUrl("automerge:local doc", {
        drawingAppBaseUrl: "http://localhost:3000/draw/",
      }),
    ).toBe("http://localhost:3000/draw/?local=automerge%3Alocal+doc");
  });
});
