import { useQueryClient } from "@tanstack/react-query";
import {
  createRootRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
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

  return (
    <div className="account-shell">
      <header className="account-header">
        <Link to="/" className="account-brand">
          <Shield />
          Splatterboard
        </Link>
        <nav className="account-nav" aria-label="Account">
          {(!meQuery.data && !meQuery.isLoading) || isNotAuthorized ? (
            <>
              <Link to="/login" search={{ redirect: getRedirectParam() }}>
                Login
              </Link>
              <Link to="/register" search={{ redirect: getRedirectParam() }}>
                Sign up
              </Link>
            </>
          ) : null}

          {meQuery.data && !isNotAuthorized ? (
            <>
              <div className="account-nav__identity">
                <div>{meQuery.data.username}</div>
                {meQuery.data.isServerAdmin ? (
                  <div className="account-muted account-muted--small">
                    server admin
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="ds-button"
                // not perfect but good enough since the local changes are fast
                disabled={logoutMutation.isPending}
                onClick={async () => {
                  logoutMutation.mutate(undefined, {
                    onSuccess: () => {
                      queryClient.invalidateQueries();
                      window.location.href = appPath("login");
                    },
                    onError: () => {
                      alert("Failed to logout");
                    },
                  });
                }}
              >
                Logout
              </button>
            </>
          ) : null}
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
