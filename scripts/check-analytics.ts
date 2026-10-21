import { expect, type Browser } from "@playwright/test";

// Route the production hostname to the isolated test server. Analytics stays
// disabled on localhost in normal development; no test hits reach GoatCounter.
export async function checkAnalytics(
  browser: Browser,
  origin: string,
  scriptSource = "",
) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });
  let scriptRequests = 0;
  context.on("request", (request) => {
    if (request.url() === "https://gc.zgo.at/count.js") scriptRequests++;
  });
  const calls: {
    path: string;
    title: string;
    event: boolean;
    referrer: string;
    no_session: boolean;
  }[] = [];
  await context.exposeBinding("recordAnalytics", (_source, payload) => {
    calls.push(payload);
  });
  await context.route("https://splatterboard.app/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${origin}${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
  await context.route("https://gc.zgo.at/count.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `${scriptSource}\nwindow.goatcounter.get_data ??= () => ({q:location.search}); const originalCount = window.goatcounter.count; window.goatcounter.count = function(payload) { window.recordAnalytics(payload); originalCount?.call(this, payload); };`,
    }),
  );
  const requests: string[] = [];
  await context.route("https://splatterboard.goatcounter.com/**", (route) => {
    requests.push(decodeURIComponent(route.request().url()));
    return route.fulfill({ status: 204 });
  });
  const page = await context.newPage();
  const eventCount = (path: string) =>
    calls.filter((call) => call.path === path).length;
  try {
    await page.goto("https://splatterboard.app/");
    await expect(
      page.getByRole("link", { name: "Start drawing", exact: true }),
    ).toBeVisible();
    await expect.poll(() => eventCount("/")).toBe(1);
    await page.goto("https://splatterboard.app/draw/?new=1&private=SECRET");
    await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
    const paper = page.locator(".kids-draw-frame");
    await expect(paper).toBeVisible();
    await page.evaluate(() => {
      document.title = "SECRET drawing title";
      (window as any).kidsDrawApp.store.activateTool("brush.marker");
    });
    expect(eventCount("tool-used/brush.marker")).toBe(0);
    const box = (await paper.boundingBox())!;
    for (const offset of [50, 100]) {
      await page.mouse.move(box.x + 50, box.y + offset);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + offset, { steps: 5 });
      await page.mouse.up();
    }
    await expect.poll(() => eventCount("tool-used/brush.marker")).toBe(1);
    await page.evaluate(() =>
      (window as any).kidsDrawApp.store.activateTool("stamp.image.bird1"),
    );
    await page.mouse.click(box.x + 120, box.y + 160);
    await expect.poll(() => eventCount("stamp-used/stamp.image.bird1")).toBe(1);
    expect(eventCount("tool-used/stamp.images")).toBe(1);
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
    await expect(paper).toBeVisible();
    await page.evaluate(() =>
      (window as any).kidsDrawApp.store.activateTool("brush.marker"),
    );
    await page.mouse.click(box.x + 90, box.y + 90);
    expect(eventCount("tool-used/brush.marker")).toBe(1);
    await page.goto("https://splatterboard.app/draw/?new=coloring");
    const dialog = page.locator(".kids-draw-new-document-dialog");
    await dialog.locator("[data-new-document-volume]").first().click();
    await dialog.locator("[data-new-document-page]").first().click();
    await expect(dialog).toBeHidden();
    await expect(paper).toBeVisible();
    await expect
      .poll(() => eventCount("coloring-opened/pdr-v1/page-001"))
      .toBe(1);
    expect(eventCount("coloring-started/pdr-v1/page-001")).toBe(0);
    await page.evaluate(() =>
      (window as any).kidsDrawApp.store.updateSharedSettings({
        strokeColor: "#ff4d6d",
      }),
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).kidsDrawApp.store.getActiveToolId(),
        ),
      )
      .toBe("fill.basic");
    await page.waitForTimeout(500);
    const coloringBox = (await paper.boundingBox())!;
    await page.mouse.click(
      coloringBox.x + coloringBox.width / 2,
      coloringBox.y + coloringBox.height / 2,
    );
    await expect
      .poll(() => eventCount("coloring-started/pdr-v1/page-001"), {
        timeout: 15000,
      })
      .toBe(1);
    expect(eventCount("tool-used/fill.basic")).toBe(1);
    expect(JSON.stringify(calls)).not.toContain("SECRET");
    expect(JSON.stringify(calls)).not.toContain("automerge:");
    expect(
      calls
        .filter((call) => call.event)
        .every((call) => call.no_session && call.referrer === ""),
    ).toBe(true);
    if (scriptSource) {
      await expect.poll(() => requests.length).toBeGreaterThan(4);
      expect(requests.join("\n")).not.toContain("SECRET");
      expect(requests.join("\n")).not.toContain("automerge:");
    }
    const settings = await context.newPage();
    await settings.goto("https://splatterboard.app/privacy#analytics");
    const checkbox = settings.getByRole("checkbox", {
      name: "Share usage statistics",
    });
    await checkbox.uncheck();
    await expect(settings.getByRole("status")).toHaveText(
      "Usage statistics are off.",
    );
    await settings.setViewportSize({ width: 390, height: 850 });
    await settings.screenshot({ path: "/tmp/analytics-settings-mobile.png" });
    await page.evaluate(() =>
      (window as any).kidsDrawApp.store.activateTool("brush.freehand"),
    );
    await page.mouse.click(coloringBox.x + 90, coloringBox.y + 90);
    await page.waitForTimeout(100);
    expect(eventCount("tool-used/brush.freehand")).toBe(0);
    const beforeReload = scriptRequests;
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
    await expect(paper).toBeVisible();
    expect(scriptRequests).toBe(beforeReload);
    await settings.reload();
    await expect(checkbox).not.toBeChecked();
    expect(scriptRequests).toBe(beforeReload);
    await checkbox.check();
    await expect.poll(() => scriptRequests).toBeGreaterThan(beforeReload);
    await settings.close();
    // Blocking the provider must leave startup and drawing functional.
    await context.route("https://gc.zgo.at/count.js", (route) => route.abort());
    await page.reload();
    await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
    await expect(paper).toBeVisible();
    console.log(
      "PASS: analytics counts actual tool/stamp/coloring use, deduplicates reloads, excludes private URLs, and tolerates blocking",
    );
  } catch (error) {
    console.error("Analytics payloads", calls);
    console.error(
      await page.evaluate(() => ({
        tool: (window as any).kidsDrawApp?.store.getActiveToolId(),
        count: Object.keys(
          (window as any).kidsDrawApp?.store.getDocument().shapes ?? {},
        ).length,
      })),
    );
    await page.screenshot({ path: "/tmp/analytics-failed.png" });
    throw error;
  } finally {
    await context.close();
  }
}
