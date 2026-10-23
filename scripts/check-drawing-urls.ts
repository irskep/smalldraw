import { expect, type Browser, type Page } from "@playwright/test";

export async function checkDrawingUrls(browser: Browser, origin: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const ready = async (p: Page = page) => {
    await p.waitForFunction(
      () => Boolean((window as any).kidsDrawApp),
      undefined,
      { timeout: 8000 },
    );
    await expect(p.locator(".kids-draw-frame")).toBeVisible();
  };
  const count = () =>
    page.evaluate(
      () =>
        Object.keys((window as any).kidsDrawApp.store.getDocument().shapes)
          .length,
    );
  try {
    await page.goto(`${origin}/draw/new`);
    await ready();
    await page.waitForURL(/\/draw\/[A-Za-z0-9_-]{20,}$/);
    const first = page.url();
    const firstId = new URL(first).pathname.split("/").at(-1)!;
    await page.evaluate(() => {
      const store = (window as any).kidsDrawApp.store;
      store.dispatch("pointerDown", { point: [30, 30], buttons: 1 });
      store.dispatch("pointerMove", { point: [150, 150], buttons: 1 });
      store.dispatch("pointerUp", { point: [170, 170], buttons: 0 });
    });
    await expect.poll(count).toBe(1);
    await page.waitForTimeout(500);
    // Older bookmarks still open the same drawing and normalize after opening.
    await page.goto(
      `${origin}/draw/?local=${encodeURIComponent(`automerge:${firstId}`)}`,
    );
    await ready();
    await expect(page).toHaveURL(first);
    await expect.poll(count).toBe(1);
    await page.goto(`${origin}/draw/new`);
    await ready();
    await page.waitForURL(/\/draw\/[A-Za-z0-9_-]{20,}$/);
    const second = page.url();
    expect(second).not.toBe(first);
    await expect.poll(count).toBe(0);
    // Exercise the editor's popstate handler without reloading its runtime.
    await page.evaluate((url) => {
      history.pushState(null, "", url);
      dispatchEvent(new PopStateEvent("popstate"));
    }, first);
    await expect.poll(count).toBe(1);
    await page.goBack();
    await expect(page).toHaveURL(second);
    await expect.poll(count).toBe(0);
    await page.goForward();
    await expect(page).toHaveURL(first);
    await expect.poll(count).toBe(1);
    // Account lookups can be stalled indefinitely without blocking a known guest.
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/**", async (route) => {
      await pending;
      await route.abort();
    });
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await ready();
      await expect.poll(count).toBe(1);
      await expect(page).toHaveURL(first);
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
    await page.goto(`${origin}/draw/shared`);
    await expect(
      page.getByText("Could not open drawing", { exact: true }),
    ).toBeVisible();
    console.log(
      `PASS ${browser.browserType().name()}: clean URLs, legacy bookmark, refresh, history, guest API independence, malformed path`,
    );
  } finally {
    await context.close();
  }
}
