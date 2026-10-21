/** WebKit can retain a failed module response across a normal reload. */
export async function retryPageLoad() {
  const failedAssets = performance
    .getEntriesByType("resource")
    .filter(
      (entry): entry is PerformanceResourceTiming =>
        entry instanceof PerformanceResourceTiming,
    )
    .filter((entry) => entry.encodedBodySize === 0)
    .map((entry) => new URL(entry.name))
    .filter(
      (url) =>
        url.origin === window.location.origin &&
        /\.(js|css)$/.test(url.pathname),
    );
  // Refresh only empty/failed local code responses, and only on explicit retry.
  // Bound the wait so a still-offline browser can always get back to the page.
  await Promise.allSettled(
    [...new Set(failedAssets.map((url) => url.href))].map((url) =>
      fetch(url, { cache: "reload", signal: AbortSignal.timeout(10_000) }),
    ),
  );
  window.location.reload();
}
