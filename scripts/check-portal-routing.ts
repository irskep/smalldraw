import { expect, type Browser } from "@playwright/test";

export async function checkPortalRouting(browser: Browser, origin: string) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  context.setDefaultTimeout(15_000);
  const page = await context.newPage();
  const errors: string[] = [];
  const startupAssets: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script" || request.url().includes(".wasm"))
      startupAssets.push(new URL(request.url()).pathname);
  });
  page.on("pageerror", (error) => {
    // WebKit reports session fetches cancelled by a full-document navigation
    // as page errors. Keep all JavaScript errors and other network errors.
    if (
      browser.browserType().name() === "webkit" &&
      /^\/localhost:\d+\/api\/v1\/me\?.* due to access control checks\.$/.test(
        error.message,
      )
    )
      return;
    errors.push(error.message);
  });
  // Distinguishes client navigation from an accidental full document load.
  await context.addInitScript(() => {
    (window as any).routingDocumentId = Math.random();
  });
  try {
    await page.goto(origin);
    await expect(
      page.getByRole("heading", { name: "A free drawing app for kids" }),
    ).toBeVisible();
    // Anonymous startup must not download the account repo or Automerge runtime.
    await page.waitForLoadState("networkidle");
    expect(
      startupAssets.filter((url) => /account-runtime-|\.wasm$/.test(url)),
    ).toEqual([]);
    expect(startupAssets.filter((url) => url.endsWith(".js"))).toHaveLength(1);
    const documentId = await page.evaluate(
      () => (window as any).routingDocumentId,
    );
    await page
      .getByRole("link", { name: "How your drawings are stored" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Where your drawings are saved",
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => (window as any).routingDocumentId)).toBe(
      documentId,
    );
    await page.waitForLoadState("networkidle");
    expect(
      startupAssets.filter((url) => /account-runtime-|\.wasm$/.test(url)),
    ).toEqual([]);
    expect(startupAssets.filter((url) => url.endsWith(".js"))).toHaveLength(2);
    await expect(page).toHaveTitle(/drawings.*stored/i);
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "A free drawing app for kids" }),
    ).toBeVisible();
    await page.goForward();
    await expect(
      page.getByRole("heading", {
        name: "Where your drawings are saved",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Splatterboard", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Privacy policy", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Privacy Policy", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => (window as any).routingDocumentId)).toBe(
      documentId,
    );
    // Fragment links need scrolling after the lazy page has rendered, including direct loads.
    await page.goto(`${origin}/privacy/#analytics`);
    await expect(page.locator("#analytics")).toBeInViewport();
    await page.goto(`${origin}/data/`);
    await expect(
      page.getByRole("heading", {
        name: "Where your drawings are saved",
        exact: true,
      }),
    ).toBeVisible();
    for (const path of [
      "/account",
      "/drawings/deleted",
      "/admin/users/test%20name/documents/test%2Fid",
      "/invitation/test%2Ftoken",
    ]) {
      await page.goto(`${origin}${path}`);
      await expect(page).toHaveURL(new RegExp("/login\\?"));
      expect(new URL(page.url()).searchParams.get("redirect")).toBe(path);
      await expect(
        page.getByRole("button", { name: "Login", exact: true }),
      ).toBeVisible();
    }
    await page.goto(origin);
    const beforeDrawing = await page.evaluate(
      () => (window as any).routingDocumentId,
    );
    await page
      .getByRole("link", { name: "Start drawing", exact: true })
      .click();
    await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
    expect(new URL(page.url()).pathname).toBe("/draw/");
    expect(
      await page.evaluate(() => (window as any).routingDocumentId),
    ).not.toBe(beforeDrawing);
    expect(errors).toEqual([]);

    // A missing deployment chunk must offer recovery, not leave a loading screen.
    await page.route(/\/assets\/portal-.*\.js$/, (route) =>
      route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "Unavailable",
        headers: { "cache-control": "no-store" },
      }),
    );
    await page.goto(`${origin}/terms`);
    await expect(
      page.getByRole("heading", { name: "This page couldn’t load" }),
    ).toBeVisible();
    await page.unroute(/\/assets\/portal-.*\.js$/);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Terms and Conditions", exact: true }),
    ).toBeVisible();
    console.log(
      "PASS: portal links, history, metadata, trailing slashes, fragments, auth redirects, editor boundary and chunk recovery",
    );
  } finally {
    await context.close();
  }
}
