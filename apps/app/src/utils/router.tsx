import { LocationProvider, Router, Route, lazy, useLocation } from "preact-iso";
import type React from "react";
import { useEffect, useState } from "react";

import { appPath, portalScope } from "../config";
import { PortalLayout } from "../routes/__root";
import { retryPageLoad } from "./retryPageLoad";

function PageLoadError() {
  const [retrying, setRetrying] = useState(false);
  return (
    <section className="portal-page" role="alert">
      <h1 className="portal-title">This page couldn’t load</h1>
      <button
        className="ds-button"
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          void retryPageLoad();
        }}
      >
        {retrying ? "Loading…" : "Try again"}
      </button>
    </section>
  );
}

// Resolve a failed chunk to a visible recovery page. preact-iso's lazy router
// otherwise waits indefinitely on a rejected import.
function page(load: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() => load().catch(() => ({ default: PageLoadError })));
}

const Home = page(() => import("../routes/index.lazy"));
const Login = page(() => import("../routes/login"));
const Register = page(() => import("../routes/register"));
const Data = page(() => import("../routes/data.lazy"));
const Privacy = page(() => import("../routes/privacy.lazy"));
const Terms = page(() => import("../routes/terms.lazy"));
const Account = page(() => import("../routes/account.lazy"));
const Deleted = page(() => import("../routes/drawings/deleted.lazy"));
const Invitation = page(() => import("../routes/invitation/$token.lazy"));
const Admin = page(() => import("../routes/admin.lazy"));
const AdminUser = page(() => import("../routes/admin/users/$username.lazy"));
const AdminDocument = page(
  () => import("../routes/admin/users/$username/documents/$documentId.lazy"),
);

function NotFound() {
  return (
    <section className="portal-page">
      <h1 className="portal-title">Page not found</h1>
      <a href={appPath("")}>Back to Splatterboard</a>
    </section>
  );
}

function scrollToFragment() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  try {
    document.getElementById(decodeURIComponent(hash))?.scrollIntoView();
  } catch {
    /* A malformed fragment should not prevent navigation. */
  }
}

function Pages({ onPageChange }: { onPageChange?: () => void }) {
  const { url } = useLocation();
  const [loading, setLoading] = useState(false);
  useEffect(scrollToFragment, [url]);
  const settled = () => {
    setLoading(false);
    scrollToFragment();
    onPageChange?.();
  };
  return (
    <>
      {loading ? <p role="status">Loading…</p> : null}
      <Router
        onLoadStart={() => setLoading(true)}
        onLoadEnd={settled}
        onRouteChange={settled}
      >
        <Route path={appPath("")} component={Home} />
        <Route path={appPath("login")} component={Login} />
        <Route path={appPath("register")} component={Register} />
        <Route path={appPath("data")} component={Data} />
        <Route path={appPath("privacy")} component={Privacy} />
        <Route path={appPath("terms")} component={Terms} />
        <Route path={appPath("account")} component={Account} />
        <Route path={appPath("drawings/deleted")} component={Deleted} />
        <Route path={appPath("invitation/:token")} component={Invitation} />
        <Route path={appPath("admin")} component={Admin} />
        <Route path={appPath("admin/users/:username")} component={AdminUser} />
        <Route
          path={appPath("admin/users/:username/documents/:documentId")}
          component={AdminDocument}
        />
        <Route default component={NotFound} />
      </Router>
    </>
  );
}

export function PortalRouter({ onPageChange }: { onPageChange?: () => void }) {
  return (
    <LocationProvider scope={portalScope(window.location.origin)}>
      <PortalLayout>
        <Pages onPageChange={onPageChange} />
      </PortalLayout>
    </LocationProvider>
  );
}
