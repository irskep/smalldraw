import { act, render } from "@testing-library/preact";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Route } from "../routes/__root";

const state = vi.hoisted(() => ({
  pathname: "/data",
  unauthorized: true,
  navigate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createRootRoute: (options: unknown) => ({ options }),
  useLocation: () => ({ pathname: state.pathname }),
  useNavigate: () => state.navigate,
  Link: () => null,
  Outlet: () => null,
}));
vi.mock("@tanstack/router-devtools", () => ({
  TanStackRouterDevtools: () => null,
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("../utils/trpc", () => ({
  trpc: {
    me: {
      useQuery: () => ({
        data: state.unauthorized ? undefined : { username: "test" },
        error: state.unauthorized
          ? { data: { code: "UNAUTHORIZED" } }
          : undefined,
        isLoading: false,
      }),
    },
    logout: { useMutation: () => ({ isPending: false }) },
  },
}));
vi.mock("../components/DsDropdownMenu/DsDropdownMenu", () => ({
  DsDropdownMenu: () => null,
}));
vi.mock(
  "../components/ParentalControlsDialog/ParentalControlsDialog",
  async () => ({
    ParentalControlsDialog: (await import("react")).forwardRef(() => null),
  }),
);

const Root = Route.options.component as ComponentType;
async function renderRoot() {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<Root />);
  });
  return view;
}
beforeEach(() => {
  state.navigate.mockClear();
  state.unauthorized = true;
});

describe("portal route authentication", () => {
  test.each([
    "/",
    "/login",
    "/register",
    "/data",
    "/privacy",
    "/terms",
    "/data/",
  ])("allows anonymous access to %s", async (pathname) => {
    state.pathname = pathname;
    vi.spyOn(window, "location", "get").mockReturnValue(
      new URL(pathname, "http://localhost") as unknown as Location,
    );
    await renderRoot();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  test.each([
    "/account",
    "/drawings/deleted",
    "/admin",
    "/admin/users/example",
    "/invitation/example",
  ])("requires login for %s", async (pathname) => {
    state.pathname = pathname;
    vi.spyOn(window, "location", "get").mockReturnValue(
      new URL(pathname, "http://localhost") as unknown as Location,
    );
    await renderRoot();
    expect(state.navigate).toHaveBeenCalledWith({
      to: "/login",
      search: { redirect: pathname },
    });
  });

  test("rechecks authentication on client navigation after an anonymous response", async () => {
    state.pathname = "/";
    vi.spyOn(window, "location", "get").mockReturnValue(
      new URL("http://localhost/") as unknown as Location,
    );
    const view = await renderRoot();
    expect(state.navigate).not.toHaveBeenCalled();
    state.pathname = "/account";
    vi.spyOn(window, "location", "get").mockReturnValue(
      new URL("http://localhost/account") as unknown as Location,
    );
    await act(async () => {
      view.rerender(<Root />);
    });
    expect(state.navigate).toHaveBeenCalledWith({
      to: "/login",
      search: { redirect: "/account" },
    });
  });

  test("allows authenticated account access", async () => {
    state.unauthorized = false;
    state.pathname = "/account";
    vi.spyOn(window, "location", "get").mockReturnValue(
      new URL("http://localhost/account") as unknown as Location,
    );
    await renderRoot();
    expect(state.navigate).not.toHaveBeenCalled();
  });
});

afterEach(() => vi.restoreAllMocks());
