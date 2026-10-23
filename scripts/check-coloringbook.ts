import { expect, type Browser } from "@playwright/test";

export async function checkColoringbook(
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
      await page.goto(`${origin}/coloringbook`);
      await expect(
        page.getByRole("heading", { name: "Free coloring book" }),
      ).toBeVisible();
      await expect(page).toHaveTitle("Free coloring book — Splatterboard");
      const preview = page.locator(".coloringbook__preview");
      await expect(preview).toBeVisible();
      await expect
        .poll(() =>
          preview.evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBe(2200);
      await page.evaluate(() => document.fonts.ready);
      // Native lazy loading keeps distant subjects from loading on initial entry.
      const distant = page.locator("#public-domain-review img").first();
      expect(
        await distant.evaluate((image: HTMLImageElement) => image.naturalWidth),
      ).toBe(0);

      await page.screenshot({
        path: `/tmp/coloringbook-header-${name}-${width}.png`,
      });
      await page
        .getByRole("link", { name: "Public Domain Review", exact: true })
        .click();
      await expect
        .poll(() =>
          distant.evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.waitForFunction(() =>
        [
          ...document.querySelectorAll<HTMLImageElement>(
            ".coloringbook__pages img",
          ),
        ]
          .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < innerHeight && rect.width > 0;
          })
          .every((image) => image.complete && image.naturalWidth > 0),
      );
      const dove = page.locator(
        '[data-coloring-page="coloring/pavelkukov/dove.svg"]',
      );
      await dove.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          dove
            .locator("img")
            .evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.screenshot({ path: `/tmp/coloringbook-${name}-${width}.png` });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const href = (await dove.getAttribute("href"))!;
      await dove.click();
      await page.waitForURL(/local=/);
      await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
      const firstUrl = page.url();
      const state = () =>
        page.evaluate(() => {
          const s = (window as any).kidsDrawApp.store;
          return {
            reference: s.getDocument().presentation.referenceImage?.src,
            count: Object.keys(s.getDocument().shapes).length,
            tool: s.getActiveToolId(),
          };
        });
      await expect.poll(state).toEqual({
        reference: "coloring/pavelkukov/dove.svg",
        count: 0,
        tool: "fill.basic",
      });
      await expect(page.locator(".kids-draw-new-document-dialog")).toBeHidden();
      await page.waitForTimeout(500);
      await page.evaluate(() =>
        (window as any).kidsDrawApp.store.updateSharedSettings({
          strokeColor: "#ff4d6d",
        }),
      );
      const paper = page.locator(".kids-draw-frame");
      const box = (await paper.boundingBox())!;
      await page.mouse.click(
        box.x + box.width * 0.4,
        box.y + box.height * 0.48,
      );
      await expect.poll(async () => (await state()).count).toBe(1);
      await page.waitForTimeout(1000);
      await page.reload();
      await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
      await expect.poll(async () => (await state()).count).toBe(1);
      await page.goto(href);
      await page.waitForURL(/local=/);
      expect(page.url()).not.toBe(firstUrl);
      await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
      await expect.poll(state).toEqual({
        reference: "coloring/pavelkukov/dove.svg",
        count: 0,
        tool: "fill.basic",
      });
      console.log(
        `PASS coloringbook ${name} ${width}: selected page, fill, reload, fresh copy`,
      );
    } finally {
      await context.close();
    }
  }
}
