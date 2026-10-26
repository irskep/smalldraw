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
    const stepper = page.locator(".ds-size-stepper:visible");
    const bigger = page.getByRole("button", { name: "Bigger", exact: true });
    const smaller = page.getByRole("button", { name: "Smaller", exact: true });
    expect((await bigger.boundingBox())!.y).toBeLessThan(
      (await smaller.boundingBox())!.y,
    );
    await page.locator('[data-tool-family="fill"]:visible').first().click();
    await expect(stepper).toHaveAttribute("aria-disabled", "true");
    await expect(stepper).toHaveCSS("opacity", "0.3");
    await expect(bigger).toBeDisabled();
    await expect(smaller).toBeDisabled();
    await page.locator('[data-tool-family="brush"]:visible').first().click();
    await expect(stepper).toHaveCSS("opacity", "1");
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
    await expect(page.locator(".kids-draw-frame")).toBeVisible();
    await expect.poll(size).toEqual(original);
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

export async function checkAspectRatioSettings(
  browser: Browser,
  origin: string,
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 900, height: 700 },
  });
  try {
    const page = await context.newPage();
    await page.goto(
      `${origin}/draw/?new=coloring&page=coloring%2Fpavelkukov%2Fcartoon_frog.svg`,
    );
    const rail = page.locator(".ds-splat-context__settings-rail");
    await expect(rail).toBeVisible();
    const metrics = () =>
      page.evaluate(() => {
        const host = document
          .querySelector(".kids-draw-viewport")!
          .getBoundingClientRect();
        const rail = document.querySelector<HTMLElement>(
          ".ds-splat-context__settings-rail",
        )!;
        const frame = document
          .querySelector(".kids-draw-frame")!
          .getBoundingClientRect();
        const doc = (
          window as Window & {
            kidsDrawApp: {
              store: {
                getDocument(): { size: { width: number; height: number } };
              };
            };
          }
        ).kidsDrawApp.store.getDocument().size;
        const compactWidth =
          host.width + (rail.hidden ? 0 : rail.getBoundingClientRect().width);
        const scale = Math.min(
          1,
          compactWidth / doc.width,
          host.height / doc.height,
        );
        return {
          width: frame.width,
          height: frame.height,
          expectedWidth: Math.round(doc.width * scale),
          expectedHeight: Math.round(doc.height * scale),
          doc,
        };
      });
    const original = (await metrics()).doc;
    for (const [width, height, visible] of [
      [900, 700, true],
      [800, 700, true],
      [700, 700, false],
      [900, 600, false],
      [900, 700, true],
    ] as const) {
      await page.setViewportSize({ width, height });
      if (visible) await expect(rail).toBeVisible();
      else await expect(rail).toBeHidden();
      await expect
        .poll(async () => {
          const result = await metrics();
          return (
            result.width === result.expectedWidth &&
            result.height === result.expectedHeight
          );
        })
        .toBe(true);
      expect((await metrics()).doc).toEqual(original);
      await expect(
        page.getByRole("button", { name: "Bigger", exact: true }),
      ).toBeInViewport();
    }
    // Several frames at unchanged bounds must not flip the layout back and forth.
    const states = await page.evaluate(async () => {
      const states: boolean[] = [];
      for (let i = 0; i < 20; i++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        states.push(
          !document.querySelector<HTMLElement>(
            ".ds-splat-context__settings-rail",
          )!.hidden,
        );
      }
      return states;
    });
    expect(states.every(Boolean)).toBe(true);
    await page.reload();
    await expect(rail).toBeVisible();
    expect((await metrics()).doc).toEqual(original);
    const blank = await context.newPage();
    await blank.goto(`${origin}/draw/?new=blank`);
    await expect(
      blank.getByRole("button", { name: "Bigger", exact: true }),
    ).toBeEnabled();
    await expect(
      blank.locator(".ds-splat-context__settings-rail"),
    ).toBeHidden();
  } finally {
    await context.close();
  }
}
