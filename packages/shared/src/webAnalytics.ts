import type { GoatCounterCountOptions } from "./goatcounter";
import type { UsageAnalytics } from "./index";

type CountPayload = Required<GoatCounterCountOptions>;

const PREFERENCE_KEY = "splatterboard-analytics-enabled";
const PREFERENCE_EVENT = "splatterboard-analytics-preference";
const preferences = new WeakMap<Window, boolean>();

export function analyticsEnabled(win: Window = window): boolean {
  const cached = preferences.get(win);
  if (cached !== undefined) return cached;
  let enabled = true;
  try {
    enabled = win.localStorage.getItem(PREFERENCE_KEY) !== "false";
  } catch {
    /* Best effort. */
  }
  preferences.set(win, enabled);
  return enabled;
}

/** Returns whether this browser could persist the choice. */
export function setAnalyticsEnabled(
  enabled: boolean,
  win: Window = window,
): boolean {
  preferences.set(win, enabled);
  let persisted = false;
  try {
    win.localStorage.setItem(PREFERENCE_KEY, String(enabled));
    persisted = true;
  } catch {
    /* Keep the in-memory choice. */
  }
  win.dispatchEvent(new Event(PREFERENCE_EVENT));
  return persisted;
}

const SESSION_KEY = "splatterboard-analytics-session";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const PUBLIC_ROUTES = new Set([
  "/",
  "/data",
  "/privacy",
  "/terms",
  "/login",
  "/register",
  "/account",
  "/drawings/deleted",
]);

export function analyticsPath(pathname: string): string | null {
  const path = pathname.replace(/\/$/, "") || "/";
  if (PUBLIC_ROUTES.has(path)) return path;
  if (path === "/draw") return "/draw/";
  if (path.startsWith("/invitation/")) return "/invitation/:token";
  if (path.startsWith("/s/")) return "/s/:token";
  if (path.startsWith("/d/")) return "/d/:document";
  return null;
}

export function createWebAnalytics(
  win: Window = window,
): UsageAnalytics & { page(pathname: string): void } {
  const production = win.location.hostname === "splatterboard.app";
  let enabled = production && analyticsEnabled(win);
  let started = false;
  let pending: CountPayload[] = [];
  let unavailable = false;
  let ready = false;
  let lastSavedAt = 0;
  let lastPath: string | null = null;
  let session = { lastActivity: 0, events: [] as string[] };
  function start() {
    if (!enabled || started) return;
    started = true;
    try {
      const saved = JSON.parse(
        win.sessionStorage.getItem(SESSION_KEY) ?? "null",
      );
      if (
        saved &&
        typeof saved.lastActivity === "number" &&
        Array.isArray(saved.events)
      ) {
        session = {
          lastActivity: saved.lastActivity,
          events: saved.events
            .filter((event: unknown) => typeof event === "string")
            .slice(0, 256),
        };
      }
    } catch {
      /* Storage may be unavailable; in-memory deduplication still works. */
    }
    win.goatcounter = { no_onload: true };
    const script = win.document.createElement("script");
    script.dataset.goatcounter = "https://splatterboard.goatcounter.com/count";
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = "https://gc.zgo.at/count.js";
    script.onload = () => {
      const getData = win.goatcounter?.get_data;
      if (!getData || !win.goatcounter) {
        pending = [];
        unavailable = true;
        return;
      }
      // count.js adds location.search independently of path. Never send local
      // document IDs, invitation tokens, or account-related query parameters.
      win.goatcounter.get_data = (options) => ({ ...getData(options), q: "" });
      ready = true;
      const queued = pending;
      pending = [];
      for (const payload of queued) send(payload);
    };
    script.onerror = () => {
      pending = [];
      unavailable = true;
    };
    win.document.head.append(script);
  }
  const updatePreference = () => {
    enabled = production && analyticsEnabled(win);
    if (!enabled) {
      pending = [];
      session = { lastActivity: 0, events: [] };
      try {
        win.sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* Best effort. */
      }
    } else start();
  };
  win.addEventListener(PREFERENCE_EVENT, updatePreference);
  win.addEventListener("storage", (event) => {
    if (event.key !== PREFERENCE_KEY && event.key !== null) return;
    preferences.delete(win);
    updatePreference();
  });
  start();
  function send(payload: CountPayload): void {
    if (!enabled || unavailable) return;
    try {
      if (ready && win.goatcounter?.count) win.goatcounter.count(payload);
      else if (pending.length < 256) pending.push(payload);
    } catch {
      /* Analytics must never interrupt drawing or navigation. */
    }
  }
  return {
    page(pathname) {
      const path = analyticsPath(pathname);
      if (!path || path === lastPath) return;
      lastPath = path;
      let referrer = "";
      try {
        const source = new URL(win.document.referrer);
        if (source.origin !== win.location.origin) referrer = source.origin;
      } catch {
        /* Direct visit. */
      }
      send({
        path,
        title: path === "/" ? "Splatterboard" : `Splatterboard ${path}`,
        referrer,
        event: false,
        no_session: false,
      });
    },
    event(name, title) {
      if (!enabled) return;
      const now = Date.now();
      if (now - session.lastActivity >= SESSION_IDLE_MS)
        session = { lastActivity: now, events: [] };
      session.lastActivity = now;
      const seen = session.events.includes(name);
      if (!seen) session.events.push(name);
      if (!seen || now - lastSavedAt > 30000) {
        lastSavedAt = now;
        try {
          win.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch {
          /* In-memory session. */
        }
      }
      if (!seen)
        send({
          path: name,
          title,
          referrer: "",
          event: true,
          no_session: true,
        });
    },
  };
}
