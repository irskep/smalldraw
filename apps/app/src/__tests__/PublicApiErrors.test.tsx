import { render } from "@testing-library/preact";
import type { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "../components/App/App";

const captured = vi.hoisted(() => ({
  client: undefined as QueryClient | undefined,
}));
vi.mock("../utils/router", () => ({ router: {} }));
vi.mock("@tanstack/react-router", () => ({ RouterProvider: () => null }));
vi.mock("../utils/trpc", () => ({
  trpcClient: {},
  trpc: {
    Provider: ({ queryClient }: { queryClient: QueryClient }) => {
      captured.client = queryClient;
      return null;
    },
  },
}));

test.each([
  "/data",
  "/privacy",
  "/terms",
  "/data/",
  "/account",
])("handles anonymous API errors on %s", async (pathname) => {
  const location = {
    pathname,
    href: `http://localhost${pathname}`,
  } as Location;
  vi.spyOn(window, "location", "get").mockReturnValue(location);
  render(<App />);
  const unauthorized = new TRPCClientError("Unauthorized", {
    result: {
      error: {
        message: "Unauthorized",
        code: -32001,
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      },
    },
  });
  await expect(
    captured.client!.fetchQuery({
      queryKey: ["me"],
      queryFn: () => {
        throw unauthorized;
      },
    }),
  ).rejects.toBeDefined();
  const destination = new URL(location.href, "http://localhost");
  expect(destination.pathname).toBe(
    pathname === "/account" ? "/login" : pathname,
  );
  if (pathname === "/account")
    expect(new URLSearchParams(destination.search).get("redirect")).toBe(
      "/account",
    );
  captured.client!.clear();
});

afterEach(() => vi.restoreAllMocks());
