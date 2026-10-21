import { describe, expect, test } from "bun:test";

import type { GoatCounterApi } from "./goatcounter";
import {
  analyticsPath,
  createWebAnalytics,
  setAnalyticsEnabled,
} from "./webAnalytics";

function browser(
  hostname = "splatterboard.app",
  storage = new Map<string, string>(),
) {
  let script: HTMLScriptElement;
  const events = new EventTarget();
  const win = {
    localStorage: { getItem: () => null, setItem: () => {} },
    addEventListener: events.addEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    location: { hostname, origin: `https://${hostname}` },
    sessionStorage: {
      removeItem: (key: string) => {
        storage.delete(key);
      },
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    document: {
      referrer: "https://example.org/private/path?token=secret",
      createElement: () => ({ dataset: {} }),
      head: {
        append: (element: HTMLScriptElement) => {
          script = element;
        },
      },
    },
    goatcounter: undefined as unknown,
  };
  const analytics = createWebAnalytics(win as unknown as Window);
  const sent: unknown[] = [];
  return {
    analytics,
    win,
    storage,
    sent,
    ready() {
      win.goatcounter = {
        count: (payload: unknown) => sent.push(payload),
        get_data: () => ({ q: "?SECRET" }),
      };
      script.onload?.(new Event("load"));
    },
    fail() {
      script.onerror?.(new Event("error"));
    },
  };
}

describe("web analytics", () => {
  test("opting out drops queued events and stops new events even if storage fails", () => {
    const b = browser();
    b.analytics.page("/");
    b.win.localStorage.setItem = () => {
      throw new Error("blocked");
    };
    expect(setAnalyticsEnabled(false, b.win as unknown as Window)).toBe(false);
    b.ready();
    b.analytics.event("tool-used/brush.marker", "Used: Marker");
    b.analytics.page("/draw/");
    expect(b.sent).toHaveLength(0);
    expect(b.storage.size).toBe(0);
    setAnalyticsEnabled(true, b.win as unknown as Window);
    b.analytics.event("tool-used/brush.marker", "Used: Marker");
    expect(b.sent).toHaveLength(1);
  });
  test("normalizes sensitive routes and excludes unknown/admin paths", () => {
    expect(analyticsPath("/draw/")).toBe("/draw/");
    expect(analyticsPath("/invitation/private-token")).toBe(
      "/invitation/:token",
    );
    expect(analyticsPath("/admin/users/private-name")).toBeNull();
    expect(analyticsPath("/some-private-document")).toBeNull();
  });
  test("queues async script loading and sends only sanitized page data", () => {
    const b = browser();
    b.analytics.page("/draw/");
    b.analytics.page("/draw/");
    expect(b.sent).toEqual([]);
    b.ready();
    expect((b.win.goatcounter as GoatCounterApi).get_data().q).toBe("");
    expect(b.sent).toEqual([
      {
        path: "/draw/",
        title: "Splatterboard /draw/",
        referrer: "https://example.org",
        event: false,
        no_session: false,
      },
    ]);
  });
  test("counts once per tab session across reload, independently of GoatCounter sessions", () => {
    const b = browser();
    b.analytics.event("tool-used/brush.marker", "Used: Marker");
    b.analytics.event("tool-used/brush.marker", "Used: Marker");
    b.ready();
    expect(b.sent).toHaveLength(1);
    expect(b.sent[0]).toMatchObject({
      event: true,
      no_session: true,
      referrer: "",
    });
    const reloaded = browser("splatterboard.app", b.storage);
    reloaded.ready();
    reloaded.analytics.event("tool-used/brush.marker", "Used: Marker");
    expect(reloaded.sent).toHaveLength(0);
    const key = [...b.storage.keys()][0];
    const expired = JSON.parse(b.storage.get(key)!);
    expired.lastActivity = Date.now() - 31 * 60 * 1000;
    b.storage.set(key, JSON.stringify(expired));
    const next = browser("splatterboard.app", b.storage);
    next.ready();
    next.analytics.event("tool-used/brush.marker", "Used: Marker");
    expect(next.sent).toHaveLength(1);
  });
  test("blocked analytics and disabled local analytics do not interrupt the app", () => {
    const b = browser();
    b.analytics.page("/");
    b.fail();
    b.analytics.event("tool-used/fill.basic", "Used: Fill");
    expect(b.sent).toHaveLength(0);
    const local = browser("localhost");
    local.analytics.page("/");
    local.analytics.event("tool-used/fill.basic", "Used: Fill");
    expect(local.win.goatcounter).toBeUndefined();
    expect(local.storage.size).toBe(0);
  });
});
