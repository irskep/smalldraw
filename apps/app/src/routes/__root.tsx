import { isUnauthorized } from "@/utils/apiErrors";
import { useAccount } from "@/utils/account";
import { updatePortalMetadata } from "../utils/portalMetadata";
import {
  DsConfirmDialog,
  type DsConfirmDialogHandle,
} from "../components/DsConfirmDialog/DsConfirmDialog";
import { $accountSync, retryAccountSync } from "@smalldraw/splat/account";
import {
  initializeAccountWorkspace,
  signOutWorkspace,
} from "../utils/accountWorkspace";
import type { DropdownMenuEntry } from "@smalldraw/design-system/dropdown-menu";
import { useLocation } from "preact-iso";
import {
  LogIn,
  LogOut,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
} from "lucide";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DsDropdownMenu } from "@/components/DsDropdownMenu/DsDropdownMenu";
import {
  ParentalControlsDialog,
  type ParentalControlsDialogHandle,
} from "@/components/ParentalControlsDialog/ParentalControlsDialog";
import { appPath, isPublicUnauthenticatedRoute } from "../config";

const getRedirectParam = () => {
  const currentUrl = window.location.href;
  const urlParams = new URLSearchParams(new URL(currentUrl).search);
  const redirectParam = urlParams.get("redirect") || undefined;
  if (redirectParam !== "/login" && redirectParam !== "/register") {
    return redirectParam;
  }
};

export const PortalLayout = ({ children }: { children?: ReactNode }) => {
  const accountDialogRef = useRef<DsConfirmDialogHandle>(null);
  const parentalControlsDialogRef = useRef<ParentalControlsDialogHandle>(null);
  const location = useLocation();
  const navigate = location.route;
  useEffect(() => updatePortalMetadata(location.path), [location.path]);
  const isInformationalRoute = ["/data", "/privacy", "/terms"].includes(
    location.path.replace(/\/+$/, ""),
  );
  const isAdminRoute =
    location.path === "/admin" || location.path.startsWith("/admin/");

  const meQuery = useAccount();
  const [syncStatus, setSyncStatus] = useState($accountSync.get());
  useEffect(() => $accountSync.subscribe(setSyncStatus), []);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    if (isInformationalRoute) return;
    void initializeAccountWorkspace()
      .then(() => setWorkspaceReady(true))
      .catch((error) => setWorkspaceError(String(error)));
  }, [isInformationalRoute]);

  const isNotAuthorized = isUnauthorized(meQuery.error);
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
    if ((!meQuery.data && !meQuery.loading) || isNotAuthorized) {
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
  }, [isNotAuthorized, signingOut, meQuery.data, meQuery.loading]);

  useEffect(() => {
    if (!isNotAuthorized || isPublicUnauthenticatedRoute(location.path)) return;
    navigate(
      appPath(`login?${new URLSearchParams({ redirect: location.url })}`),
      true,
    );
  }, [isNotAuthorized, location.path, location.url, navigate]);

  const handleMenuSelect = useCallback(
    (itemId: string) => {
      if (itemId === "login") {
        const redirect = getRedirectParam();
        navigate(
          appPath("login") +
            (redirect ? `?${new URLSearchParams({ redirect })}` : ""),
        );
        return;
      }
      if (itemId === "register") {
        const redirect = getRedirectParam();
        navigate(
          appPath("register") +
            (redirect ? `?${new URLSearchParams({ redirect })}` : ""),
        );
        return;
      }
      if (itemId === "deleted-drawings") {
        navigate(appPath("drawings/deleted"));
        return;
      }
      if (itemId === "account") {
        navigate(appPath("account"));
        return;
      }
      if (itemId === "admin") {
        navigate(appPath("admin"));
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
            message:
              "Your drawings will stay in your account. They’ll be removed from this device.",
            confirmLabel: "Sign out",
            cancelLabel: "Cancel",
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
                message:
                  "Connect to the internet and try again. Your drawings are still on this device.",
                confirmLabel: "Try again",
                cancelLabel: "Cancel",
              });
              if (!retry) {
                window.location.reload();
                return;
              }
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
      data-layout={isAdminRoute ? "admin" : location.path === "/" ? "home" : ""}
    >
      <header className="portal-header">
        <a href={appPath("")} className="portal-brand">
          Splatterboard
        </a>
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
      {syncStatus.error ? (
        <div role="status">
          {syncStatus.error}{" "}
          <button className="ds-button" onClick={retryAccountSync}>
            Try again
          </button>
        </div>
      ) : null}
      <main className="portal-main">
        {isInformationalRoute || workspaceReady ? (
          children
        ) : (
          <p role="status">
            {workspaceError ?? "Opening your drawings…"}{" "}
            {workspaceError ? (
              <button
                className="ds-button"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            ) : null}
          </p>
        )}
      </main>
      <DsConfirmDialog ref={accountDialogRef} />
      <ParentalControlsDialog
        ref={parentalControlsDialogRef}
        accountSessionExpected={Boolean(meQuery.data) && !isNotAuthorized}
      />
    </div>
  );
};
