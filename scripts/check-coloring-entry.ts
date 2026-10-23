import { chromium, expect, webkit, type Browser } from "@playwright/test";

export async function checkColoringEntry(
  browser: Browser,
  origin: string,
  name: string,
  widths = [1280, 390, 320],
) {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 850 },
    });
    context.setDefaultTimeout(15000);
    await context.addInitScript(() => {
      (window as any).creationControlsFlashed = false;
      new MutationObserver(() => {
        const launcher = document.querySelector(".portal-launcher");
        const grid = launcher?.querySelector(".portal-launcher-grid");
        if (
          launcher?.textContent?.includes("Loading drawings…") &&
          grid instanceof HTMLElement &&
          grid.offsetHeight > 0
        )
          (window as any).creationControlsFlashed = true;
      }).observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    });
    const page = await context.newPage();
    const diagnostics: string[] = [];
    page.on("console", (message) => diagnostics.push(message.text()));
    page.on("pageerror", (error) => diagnostics.push(String(error)));
    try {
      await page.goto(origin);
      const entry = page.getByRole("link", {
        name: "Pick a coloring page",
        exact: true,
      });
      await expect(entry).toBeInViewport();
      await expect(
        page.getByRole("link", { name: "Start drawing", exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(() => (window as any).creationControlsFlashed),
      ).toBe(false);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `/tmp/coloring-landing-${name}-${width}.png`,
        fullPage: true,
      });
      await entry.click();
      const dialog = page.locator(".kids-draw-new-document-dialog");
      await expect(dialog).toBeVisible();
      await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
      await expect(
        dialog.getByText("Pick something to color", { exact: true }),
      ).toBeVisible();
      await expect(
        dialog.locator('[data-new-document-mode="normal"]'),
      ).toBeHidden();
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await expect(entry).toBeVisible();
      expect(
        await page.evaluate(() => (window as any).creationControlsFlashed),
      ).toBe(false);
      await entry.click();
      await expect(dialog).toBeVisible();
      await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
      const catalogCheck = await context.newPage();
      await catalogCheck.goto(origin);
      await expect(catalogCheck.locator(".art-table")).toBeVisible();
      await catalogCheck.close();
      const previewsFit = await dialog
        .locator(".ds-choice-card__media > img")
        .evaluateAll((images) =>
          images.every((image) => {
            const media = image.parentElement!.getBoundingClientRect();
            const bounds = image.getBoundingClientRect();
            return (
              bounds.width <= media.width + 1 &&
              bounds.height <= media.height + 1
            );
          }),
        );
      expect(previewsFit).toBe(true);
      await page.screenshot({
        path: `/tmp/coloring-books-${name}-${width}.png`,
      });
      const categoryId =
        width === 1280
          ? "dinosaurs"
          : width === 320
            ? "public-domain-review"
            : "animals";
      await dialog
        .locator(`[data-new-document-category="${categoryId}"]`)
        .click();
      await expect(
        dialog.getByText("Pick a page", { exact: true }),
      ).toBeVisible();
      if (width <= 600) {
        const heading = (await dialog
          .locator(".ds-dialog-scaffold__heading")
          .boundingBox())!;
        const title = (await dialog
          .locator(".ds-dialog-scaffold__title")
          .boundingBox())!;
        const back = (await dialog
          .getByRole("button", { name: "Back", exact: true })
          .boundingBox())!;
        const close = (await dialog
          .getByRole("button", { name: "Close", exact: true })
          .boundingBox())!;
        expect(heading.width).toBeGreaterThan(width * 0.8);
        expect(title.height).toBeLessThan(35);
        expect(heading.y).toBeGreaterThanOrEqual(back.y + back.height);
        expect(close.y).toBeCloseTo(back.y, 0);
      }
      await page.screenshot({
        path: `/tmp/coloring-pages-${name}-${width}.png`,
      });
      await dialog.locator("[data-new-document-page]").first().click();
      await expect(dialog).toBeHidden();
      await page.waitForURL(/local=/);
      const paper = page.locator(".kids-draw-frame");
      await expect(paper).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as any).kidsDrawApp.store.getActiveToolId(),
          ),
        )
        .toBe("fill.basic");
      expect(
        await page.evaluate(
          () =>
            (window as any).kidsDrawApp.store.getDocument().presentation
              .documentType,
        ),
      ).toBe("coloring");
      await page.waitForTimeout(500);
      const count = () =>
        page.evaluate(
          () =>
            Object.keys((window as any).kidsDrawApp.store.getDocument().shapes)
              .length,
        );
      const before = await count();
      await page.evaluate(() =>
        (window as any).kidsDrawApp.store.updateSharedSettings({
          strokeColor: "#ff4d6d",
        }),
      );
      const box = (await paper.boundingBox())!;
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await expect.poll(count, { timeout: 15000 }).toBeGreaterThan(before);
      const filled = await count();
      await page.screenshot({
        path: `/tmp/coloring-filled-${name}-${width}.png`,
      });
      await page.waitForTimeout(1200);
      await page.reload();
      await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
      await expect(paper).toBeVisible();
      await expect.poll(count).toBe(filled);
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page
        .getByRole("menuitem", { name: "Your drawings", exact: true })
        .click();
      const browserDialog = page.locator(".kids-draw-document-browser-dialog");
      await expect(browserDialog.locator("img").first()).toBeVisible();
      await browserDialog
        .getByRole("button", { name: "New drawing", exact: true })
        .click();
      await expect(
        dialog.locator("[data-new-document-category]").first(),
      ).toBeVisible();
      await page.goto(origin);
      await expect(
        page.getByRole("heading", { name: "Your drawings", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".portal-launcher img").first()).toBeVisible();
      await expect(
        page.getByRole("link", { name: "New drawing", exact: true }),
      ).toBeVisible();
      await expect(entry).toBeVisible();
      await page.screenshot({
        path: `/tmp/coloring-saved-drawings-${name}-${width}.png`,
        fullPage: true,
      });
      await entry.click();
      await expect(
        dialog.getByText("Pick something to color", { exact: true }),
      ).toBeVisible();
      await expect(
        dialog.locator('[data-new-document-mode="normal"]'),
      ).toBeHidden();
      console.log(
        `PASS ${name} ${width}: landing → categories → page → fill → reload → saved drawing`,
      );
    } catch (error) {
      console.error(error);
      console.error(
        `FAIL ${name} ${width} at ${page.url()}\n${diagnostics.join("\n")}`,
      );
      await page
        .screenshot({ path: `/tmp/coloring-failed-${name}-${width}.png` })
        .catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
}

if (import.meta.main) {
  const origin = process.argv[2];
  if (!origin)
    throw new Error("Usage: bun scripts/check-coloring-entry.ts <origin>");
  const engines = { chromium, webkit };
  const engineName = process.argv[3];
  if (engineName) {
    if (engineName !== "chromium" && engineName !== "webkit")
      throw new Error("Unknown browser");
    const width = Number(process.argv[4]);
    if (![1280, 390, 320].includes(width))
      throw new Error("Unsupported viewport width");
    const browser = await engines[engineName].launch();
    try {
      await checkColoringEntry(browser, origin, engineName, [width]);
    } finally {
      await browser.close();
    }
  } else {
    // Keep each live check in its own runner process: standalone WebKit can
    // exit unexpectedly when several isolated contexts share a long-lived runner.
    for (const name of Object.keys(engines)) {
      for (const width of [1280, 390, 320]) {
        const child = Bun.spawn(
          [process.execPath, import.meta.path, origin, name, String(width)],
          {
            stdout: "inherit",
            stderr: "inherit",
          },
        );
        if ((await child.exited) !== 0)
          throw new Error(`${name} ${width} failed`);
      }
    }
  }
}
