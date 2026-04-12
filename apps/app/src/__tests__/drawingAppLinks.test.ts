import { describe, expect, test } from "vitest";
import {
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
          hostname: "localhost",
        },
      ),
    ).toEqual({
      drawingAppBaseUrl: "https://draw.example.com",
    });
  });

  test("derives drawing app base URL from account-web host", () => {
    expect(
      createAccountWebRuntimeConfig(
        {},
        {
          protocol: "http:",
          hostname: "localhost",
        },
      ),
    ).toEqual({
      drawingAppBaseUrl: "http://localhost:3000",
    });
    expect(
      resolveDrawingAppBaseUrl({
        protocol: "http:",
        hostname: "localhost",
      }),
    ).toBe("http://localhost:3000");
    expect(
      resolveDrawingAppBaseUrl({
        protocol: "http:",
        hostname: "192.168.1.58",
      }),
    ).toBe("http://192.168.1.58:3000");
  });

  test("builds canonical drawing app document URL", () => {
    expect(
      buildDrawingDocumentUrl("doc with spaces", {
        drawingAppBaseUrl: "http://localhost:3000",
      }),
    ).toBe("http://localhost:3000/?doc=doc+with+spaces");
  });
});
