import { expect, type Browser } from "@playwright/test";

export async function checkToolSettings(
  browser: Browser,
  origin: string,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/draw/?new=blank`);
    await expect(
      page.getByRole("button", { name: "Bigger", exact: true }),
    ).toBeEnabled();
    const size = () =>
      page.evaluate(() => {
        const app = (
          window as Window & {
            kidsDrawApp: {
              store: {
                getDocument(): { size: { width: number; height: number } };
              };
            };
          }
        ).kidsDrawApp;
        return app.store.getDocument().size;
      });
    const original = await size();
    const host = await page
      .locator(".kids-draw-viewport")
      .evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight }));
    expect(original).toEqual(host);
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [1024, 768],
      [1023, 768],
      [1024, 699],
      [390, 844],
      [320, 740],
      [844, 320],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      const wide = width! >= 1024 && height! >= 700;
      await expect(page.locator(".ds-splat-context__scene")).toHaveClass(
        wide ? /scene--settings-rail/ : /^(?!.*scene--settings-rail)/,
      );
      await expect(
        page.getByRole("button", { name: "Smaller", exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "Bigger", exact: true }),
      ).toBeInViewport();
      const label = page.locator(".ds-splat-context__active-tool");
      await expect(label).toBeInViewport();
      expect((await label.boundingBox())!.height).toBeLessThan(30);
      expect(await size()).toEqual(original);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    const blue = page.locator(
      '.ds-splat-context__settings-rail [data-color="#2e86ff"]',
    );
    await blue.click();
    await expect(blue).toHaveAttribute("aria-checked", "true");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Colors", exact: true }).click();
    await expect(
      page.locator('.ds-color-picker [data-color="#2e86ff"]'),
    ).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Bigger", exact: true }),
    ).toBeEnabled();
    expect(await size()).toEqual(original);
    const resizedHost = await page
      .locator(".kids-draw-viewport")
      .evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight }));
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "New drawing", exact: true })
      .click();
    await page.getByRole("button", { name: "Blank page", exact: true }).click();
    await expect.poll(size).toEqual(resizedHost);
  } finally {
    await context.close();
  }
}
