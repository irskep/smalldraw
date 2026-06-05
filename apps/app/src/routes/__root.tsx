import { useQueryClient } from "@tanstack/react-query";
import type { DropdownMenuEntry } from "@smalldraw/design-system/dropdown-menu";
import {
  createRootRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { LogIn, LogOut, Shield, Trash2, UserPlus } from "lucide";
import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
import { DsDropdownMenu } from "@/components/DsDropdownMenu/DsDropdownMenu";
import { appPath, basePath, isAppRoute } from "../config";
import { trpc } from "../utils/trpc";

const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null // render nothing in production
    : lazy(() =>
        // lazy load in development
        import("@tanstack/router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

const getRedirectParam = () => {
  const currentUrl = window.location.href;
  const urlParams = new URLSearchParams(new URL(currentUrl).search);
  const redirectParam = urlParams.get("redirect") || undefined;
  if (redirectParam !== "/login" && redirectParam !== "/register") {
    return redirectParam;
  }
};

const Root = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname === "/admin";

  const meQuery = trpc.me.useQuery(undefined, {
    // avoid lot's of retries in case of unauthorized blocking a page load
    retry: (failureCount, error) => {
      if (error.data?.code === "UNAUTHORIZED") {
        return false;
      }
      if (failureCount > 3) return false;
      return true;
    },
  });
  const logoutMutation = trpc.logout.useMutation();
  const queryClient = useQueryClient();

  const isNotAuthorized = meQuery.error?.data?.code === "UNAUTHORIZED";
  const accountMenuEntries = useMemo<DropdownMenuEntry[]>(() => {
    if (meQuery.data && !isNotAuthorized) {
      return [
        ...(meQuery.data.isServerAdmin
          ? [
              {
                id: "admin",
                label: "Admin",
                icon: Shield,
              },
            ]
          : []),
        {
          id: "deleted-drawings",
          label: "Deleted drawings",
          icon: Trash2,
        },
        {
          id: "logout",
          label: "Log out",
          icon: LogOut,
          disabled: logoutMutation.isPending,
        },
      ];
    }
    if ((!meQuery.data && !meQuery.isLoading) || isNotAuthorized) {
      return [
        { id: "login", label: "Login", icon: LogIn },
        { id: "register", label: "Sign up", icon: UserPlus },
      ];
    }
    return [];
  }, [
    isNotAuthorized,
    logoutMutation.isPending,
    meQuery.data,
    meQuery.isLoading,
  ]);

  useEffect(() => {
    if (!isNotAuthorized || isAppRoute("login") || isAppRoute("register")) {
      return;
    }
    if (window.location.pathname === basePath) {
      return;
    }
    navigate({
      to: "/login",
      search:
        window.location.pathname !== basePath
          ? { redirect: window.location.pathname }
          : undefined,
    });
  }, [isNotAuthorized, navigate]);

  const handleMenuSelect = useCallback(
    (itemId: string) => {
      if (itemId === "login") {
        navigate({
          to: "/login",
          search: { redirect: getRedirectParam() },
        });
        return;
      }
      if (itemId === "register") {
        navigate({
          to: "/register",
          search: { redirect: getRedirectParam() },
        });
        return;
      }
      if (itemId === "deleted-drawings") {
        navigate({ to: "/drawings/deleted" });
        return;
      }
      if (itemId === "admin") {
        navigate({ to: "/admin" });
        return;
      }
      if (itemId === "logout") {
        logoutMutation.mutate(undefined, {
          onSuccess: () => {
            queryClient.invalidateQueries();
            window.location.href = appPath("login");
          },
          onError: () => {
            alert("Failed to logout");
          },
        });
      }
    },
    [logoutMutation, navigate, queryClient],
  );

  return (
    <div className="account-shell" data-layout={isAdminRoute ? "admin" : ""}>
      <header className="account-header">
        <Link to="/" className="account-brand">
          Splatterboard
        </Link>
        <nav className="account-nav" aria-label="Account">
          {meQuery.data && !isNotAuthorized ? (
            <div className="account-nav__identity" aria-live="polite">
              {meQuery.data.username}
              {meQuery.data.isServerAdmin ? " (admin)" : ""}
            </div>
          ) : null}
          <DsDropdownMenu
            label="Menu"
            menuLabel="Account"
            entries={accountMenuEntries}
            onSelect={handleMenuSelect}
          />
        </nav>
      </header>
      <main className="account-main">
        <Outlet />
      </main>
      <Suspense>
        <TanStackRouterDevtools />
      </Suspense>{" "}
    </div>
  );
};

export const Route = createRootRoute({
  component: Root,
});
