import type { ComponentChildren } from "preact";
import { render, screen } from "@testing-library/preact";
import { afterEach, expect, test, vi } from "vitest";
import { PortalRouter } from "../utils/router";

const state = vi.hoisted(() => ({ admin: true }));
vi.mock("../routes/__root", () => ({
  PortalLayout: ({ children }: { children: ComponentChildren }) => children,
}));
vi.mock("../utils/account", () => ({
  useAccount: () => ({ data: { isServerAdmin: state.admin } }),
}));
vi.mock("../admin/AdminUserSupportPage", () => ({
  AdminUserSupportPage: ({
    username,
    documentId,
  }: {
    username: string;
    documentId?: string;
  }) => <output>{JSON.stringify({ username, documentId })}</output>,
}));

afterEach(() => {
  state.admin = true;
  vi.unstubAllGlobals();
});

test("decodes admin parameters once and matches the document route", async () => {
  vi.stubGlobal(
    "location",
    new URL(
      "/admin/users/some%20one%2F%2520/documents/id%2Ftwo",
      "http://localhost",
    ),
  );
  render(<PortalRouter />);
  expect(
    await screen.findByText(
      JSON.stringify({ username: "some one/%20", documentId: "id/two" }),
    ),
  ).toBeTruthy();
});

test("matches the user route without requiring a document", async () => {
  vi.stubGlobal(
    "location",
    new URL("/admin/users/someone/", "http://localhost"),
  );
  render(<PortalRouter />);
  expect(
    await screen.findByText(JSON.stringify({ username: "someone" })),
  ).toBeTruthy();
});

test.each([
  "/admin/users/someone",
  "/admin/users/someone/documents/doc",
])("gates direct access to %s", async (path) => {
  state.admin = false;
  vi.stubGlobal("location", new URL(path, "http://localhost"));
  render(<PortalRouter />);
  expect(
    await screen.findByRole("heading", { name: "Admin access required" }),
  ).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});
