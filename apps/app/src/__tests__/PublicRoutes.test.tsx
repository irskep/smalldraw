import { act, render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PortalLayout as Root } from "../routes/__root";

const state = vi.hoisted(() => ({
  pathname: "/data",
  unauthorized: true,
  navigate: vi.fn(),
}));
vi.mock("preact-iso", () => ({
  useLocation: () => ({
    path: state.pathname,
    url: state.pathname,
    route: state.navigate,
  }),
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
    expect(state.navigate).toHaveBeenCalledWith(
      `/login?${new URLSearchParams({ redirect: pathname })}`,
      true,
    );
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
    expect(state.navigate).toHaveBeenCalledWith(
      "/login?redirect=%2Faccount",
      true,
    );
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
