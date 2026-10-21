import { expect, type Browser } from "@playwright/test";

export async function checkColoringEntry(
  browser: Browser,
  origin: string,
  name: string,
) {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 850 },
    });
    const page = await context.newPage();
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
        dialog.getByText("Pick a coloring book", { exact: true }),
      ).toBeVisible();
      await expect(
        dialog.locator('[data-new-document-mode="normal"]'),
      ).toBeHidden();
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await expect(entry).toBeVisible();
      await entry.click();
      await expect(dialog).toBeVisible();
      await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
      const catalogCheck = await context.newPage();
      await catalogCheck.goto(origin);
      await expect(catalogCheck.locator(".art-table")).toBeVisible();
      await catalogCheck.close();
      await page.screenshot({
        path: `/tmp/coloring-books-${name}-${width}.png`,
      });
      await dialog.locator("[data-new-document-volume]").first().click();
      await expect(
        dialog.getByText("Pick a page", { exact: true }),
      ).toBeVisible();
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
      await page.goto(origin);
      await expect(
        page.getByRole("heading", { name: "Your drawings", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".portal-launcher img").first()).toBeVisible();
      console.log(
        `PASS ${name} ${width}: landing → books → page → fill → reload → saved drawing`,
      );
    } finally {
      await context.close();
    }
  }
}
