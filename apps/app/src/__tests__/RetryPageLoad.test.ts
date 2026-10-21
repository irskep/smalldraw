import { afterEach, expect, test, vi } from "vitest";
import { retryPageLoad } from "../utils/retryPageLoad";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("refreshes only empty local code assets, then reloads even if a retry fails", async () => {
  class Timing {
    constructor(
      public name: string,
      public encodedBodySize: number,
    ) {}
  }
  vi.stubGlobal("PerformanceResourceTiming", Timing);
  const signal = new AbortController().signal;
  vi.stubGlobal("AbortSignal", { timeout: vi.fn(() => signal) });
  const failed = "https://splatterboard.app/assets/page.js";
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([
    new Timing(failed, 0),
    new Timing(failed, 0),
    new Timing("https://splatterboard.app/assets/style.css", 0),
    new Timing("https://splatterboard.app/assets/loaded.js", 100),
    new Timing("https://example.com/external.js", 0),
    new Timing("https://splatterboard.app/api/me", 0),
    new Timing("https://splatterboard.app/image.png", 0),
  ] as unknown as PerformanceResourceTiming[]);
  const reload = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({
    origin: "https://splatterboard.app",
    reload,
  } as unknown as Location);
  const fetch = vi.fn().mockRejectedValue(new Error("Offline"));
  vi.stubGlobal("fetch", fetch);
  await retryPageLoad();
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    failed,
    "https://splatterboard.app/assets/style.css",
  ]);
  expect(fetch.mock.calls[0][1]).toMatchObject({
    cache: "reload",
    signal,
  });
  expect(reload).toHaveBeenCalledOnce();
});
