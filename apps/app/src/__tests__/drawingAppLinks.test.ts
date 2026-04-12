import { describe, expect, test } from "vitest";
import {
  buildDrawingDocumentUrl,
  resolveDrawingAppBaseUrl,
} from "../utils/drawingAppLinks";

describe("drawing app links", () => {
  test("derives drawing app base URL from account-web host", () => {
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
        protocol: "http:",
        hostname: "localhost",
      }),
    ).toBe("http://localhost:3000/?doc=doc+with+spaces");
  });
});
