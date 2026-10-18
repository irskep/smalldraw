import { DsConfirmDialog, type DsConfirmDialogHandle } from "../components/DsConfirmDialog/DsConfirmDialog";
import { $accountSync, retryAccountSync } from "@smalldraw/splat/account";
import { initializeAccountWorkspace, signOutWorkspace } from "../utils/accountWorkspace";
import type { DropdownMenuEntry } from "@smalldraw/design-system/dropdown-menu";
import {
  createRootRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import {
  LogIn,
  LogOut,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
} from "lucide";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DsDropdownMenu } from "@/components/DsDropdownMenu/DsDropdownMenu";
import {
  ParentalControlsDialog,
  type ParentalControlsDialogHandle,
} from "@/components/ParentalControlsDialog/ParentalControlsDialog";
import { appPath, isPublicUnauthenticatedRoute } from "../config";
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
  const accountDialogRef = useRef<DsConfirmDialogHandle>(null);
  const parentalControlsDialogRef = useRef<ParentalControlsDialogHandle>(null);
  const location = useLocation();
  const isAdminRoute =
    location.pathname === "/admin" || location.pathname.startsWith("/admin/");

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
  const [syncStatus, setSyncStatus] = useState($accountSync.get());
  useEffect(() => $accountSync.subscribe(setSyncStatus), []);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    void initializeAccountWorkspace().then(() => setWorkspaceReady(true)).catch((error) => setWorkspaceError(String(error)));
  }, []);

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
          id: "account",
          label: "Account",
          icon: User,
        },
        {
          id: "deleted-drawings",
          label: "Deleted drawings",
          icon: Trash2,
        },
        {
          id: "parental-controls",
          label: "Parental controls",
          icon: ShieldCheck,
        },
        {
          id: "logout",
          label: "Log out",
          icon: LogOut,
          disabled: signingOut,
        },
      ];
    }
    if ((!meQuery.data && !meQuery.isLoading) || isNotAuthorized) {
      return [
        { id: "login", label: "Login", icon: LogIn },
        { id: "register", label: "Sign up", icon: UserPlus },
        {
          id: "parental-controls",
          label: "Parental controls",
          icon: ShieldCheck,
        },
      ];
    }
    return [
      {
        id: "parental-controls",
        label: "Parental controls",
        icon: ShieldCheck,
      },
    ];
  }, [
    isNotAuthorized,
    signingOut,
    meQuery.data,
    meQuery.isLoading,
  ]);

  useEffect(() => {
    if (!isNotAuthorized || isPublicUnauthenticatedRoute(location.pathname))
      return;
    navigate({
      to: "/login",
      search: { redirect: location.pathname },
    });
  }, [isNotAuthorized, location.pathname, navigate]);

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
      if (itemId === "account") {
        navigate({ to: "/account" });
        return;
      }
      if (itemId === "admin") {
        navigate({ to: "/admin" });
        return;
      }
      if (itemId === "parental-controls") {
        void parentalControlsDialogRef.current?.open();
        return;
      }
      if (itemId === "logout") {
        void (async () => {
          const confirmed = await accountDialogRef.current?.confirm({
            title: "Sign out?",
            message: "Your drawings will stay in your account. They’ll be removed from this device.",
            confirmLabel: "Sign out", cancelLabel: "Cancel",
          });
          if (!confirmed) return;
          setSigningOut(true);
          for (;;) {
            try {
              await signOutWorkspace();
              window.location.href = appPath("");
              return;
            } catch {
              const retry = await accountDialogRef.current?.confirm({
                title: "Drawings haven’t finished syncing",
                message: "Connect to the internet and try again. Your drawings are still on this device.",
                confirmLabel: "Try again", cancelLabel: "Cancel",
              });
              if (!retry) { window.location.reload(); return; }
            }
          }
        })();
      }
    },
    [navigate],
  );

  return (
    <div
      className="portal-shell"
      data-layout={
        isAdminRoute ? "admin" : location.pathname === "/" ? "home" : ""
      }
    >
      <header className="portal-header">
        <Link to="/" className="portal-brand">
          Splatterboard
        </Link>
        <nav className="portal-nav" aria-label="Account">
          {meQuery.data && !isNotAuthorized ? (
            <div className="portal-nav__identity" aria-live="polite">
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
      {syncStatus.error ? <div role="status">{syncStatus.error} <button className="ds-button" onClick={retryAccountSync}>Try again</button></div> : null}
      <main className="portal-main">
        {workspaceReady ? <Outlet /> : <p role="status">{workspaceError ?? "Opening your drawings…"} {workspaceError ? <button className="ds-button" onClick={() => window.location.reload()}>Try again</button> : null}</p>}
      </main>
      <Suspense>
        <TanStackRouterDevtools />
      </Suspense>{" "}
      <DsConfirmDialog ref={accountDialogRef} />
      <ParentalControlsDialog
        ref={parentalControlsDialogRef}
        accountSessionExpected={Boolean(meQuery.data) && !isNotAuthorized}
      />
    </div>
  );
};

export const Route = createRootRoute({
  component: Root,
});
