import { TRPCClientError } from "@trpc/client";
import { afterEach, expect, test, vi } from "vitest";
import { handleApiError } from "../utils/apiErrors";

test.each([
  "/data",
  "/privacy",
  "/terms",
  "/data/",
  "/account",
])("handles anonymous API errors on %s", async (pathname) => {
  const location = {
    pathname,
    search: "",
    hash: "",
    href: `http://localhost${pathname}`,
  } as Location;
  vi.spyOn(window, "location", "get").mockReturnValue(location);
  const unauthorized = new TRPCClientError("Unauthorized", {
    result: {
      error: {
        message: "Unauthorized",
        code: -32001,
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      },
    },
  });
  handleApiError(unauthorized);
  const destination = new URL(location.href, "http://localhost");
  expect(destination.pathname).toBe(
    pathname === "/account" ? "/login" : pathname,
  );
  if (pathname === "/account")
    expect(new URLSearchParams(destination.search).get("redirect")).toBe(
      "/account",
    );
});

afterEach(() => vi.restoreAllMocks());
