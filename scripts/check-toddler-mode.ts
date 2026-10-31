import { expect, type Browser, type Page } from "@playwright/test";

async function snapshot(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).kidsDrawApp?.store));
  return page.evaluate(() => {
    const app = (window as any).kidsDrawApp;
    const document = app.store.getDocument();
    return {
      size: document.size,
      tool: app.store.getActiveToolId(),
      settings: app.store.getSharedSettings(),
      shapes: Object.keys(document.shapes).length,
      resolution: Array.from(
        window.document.querySelectorAll<HTMLCanvasElement>(".kids-draw-hot"),
      ).map((c) => [c.width, c.height]),
    };
  });
}

async function enter(page: Page) {
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Toddler mode", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Exit toddler mode", exact: true }),
  ).toBeVisible();
}

async function exit(page: Page, confirm: boolean) {
  await page
    .getByRole("button", { name: "Exit toddler mode", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", {
      name: confirm ? "Exit toddler mode" : "Keep drawing",
      exact: true,
    })
    .click();
  await expect(dialog).not.toBeVisible();
}

export async function checkToddlerMode(
  browser: Browser,
  origin: string,
  name: string,
) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/draw/?new=blank`);
    await expect(
      page.getByRole("button", { name: "Bigger", exact: true }),
    ).toBeEnabled();
    const before = await snapshot(page);
    await enter(page);
    expect((await snapshot(page)).resolution).toEqual(before.resolution);
    await expect(
      page.getByRole("button", { name: "Menu", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator(
        '[data-tool-family]:visible, [data-tool-variant]:visible, [data-action="randomize"]:visible, [data-action="undo"]:visible, [data-action="redo"]:visible',
      ),
    ).toHaveCount(0);
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
      [320, 568],
      [667, 320],
      [844, 390],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      const colors = page.locator(".ds-color-picker__swatch:visible");
      await expect(colors).toHaveCount(12);
      for (const color of await colors.all())
        await expect(color).toBeInViewport({ ratio: 1 });
      await expect(
        page.getByRole("button", { name: "Bigger", exact: true }),
      ).toBeInViewport({ ratio: 1 });
      await expect(
        page.getByRole("button", { name: "Exit toddler mode", exact: true }),
      ).toBeInViewport({ ratio: 1 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await snapshot(page)).size).toEqual(before.size);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-color="#2e86ff"]:visible').tap();
    await page.getByRole("button", { name: "Bigger", exact: true }).tap();
    const settings = await snapshot(page);
    expect(settings.settings.strokeColor).toBe("#2e86ff");
    expect(settings.settings.strokeWidth).toBeGreaterThan(
      before.settings.strokeWidth,
    );
    expect(settings.tool).toBe(before.tool);

    // Start above the paper and enter without lifting. Chromium exposes native
    // touch-drag injection; WebKit covers mouse capture and native touch taps.
    const paper = (await page.locator(".kids-draw-overlay").boundingBox())!;
    const x = paper.x + paper.width / 3;
    if (name === "chromium") {
      const input = await context.newCDPSession(page);
      await input.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: paper.y - 20 }],
      });
      await input.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: paper.y + 20 }],
      });
      await input.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + 60, y: paper.y + 50 }],
      });
      await input.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await input.detach();
    } else {
      await page.mouse.move(x, paper.y - 20);
      await page.mouse.down();
      await page.mouse.move(x, paper.y + 20, { steps: 8 });
      await page.mouse.move(x + 60, paper.y + 50, { steps: 8 });
      await page.mouse.up();
    }
    await expect.poll(async () => (await snapshot(page)).shapes).toBe(1);

    // A palette press dragged onto paper must never start a stroke.
    const swatch = (await page
      .locator('[data-color="#63c132"]:visible')
      .boundingBox())!;
    await page.mouse.move(swatch.x + 10, swatch.y + 10);
    await page.mouse.down();
    await page.mouse.move(x, paper.y + 50, { steps: 8 });
    await page.mouse.up();
    expect((await snapshot(page)).shapes).toBe(1);
    await exit(page, false);
    await expect(
      page.locator(".ds-splat-context__scene--focused"),
    ).toBeVisible();
    await page.screenshot({ path: `/tmp/toddler-${name}-phone.png` });
    await exit(page, true);
    await expect(
      page.getByRole("button", { name: "Menu", exact: true }),
    ).toBeVisible();
    expect((await snapshot(page)).shapes).toBe(1);
    expect((await snapshot(page)).size).toEqual(before.size);
    // The same forgiving entry works in normal mode, and remains undoable.
    const regularPaper = (await page
      .locator(".kids-draw-overlay")
      .boundingBox())!;
    await page.mouse.move(regularPaper.x + 40, regularPaper.y - 10);
    await page.mouse.down();
    await page.mouse.move(regularPaper.x + 50, regularPaper.y + 20, {
      steps: 8,
    });
    await page.mouse.move(regularPaper.x + 80, regularPaper.y + 30, {
      steps: 8,
    });
    await page.mouse.up();
    await expect.poll(async () => (await snapshot(page)).shapes).toBe(2);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).shapes).toBe(1);
    // Native touch placement and stamp rotation retain the chosen variant.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .locator('[data-tool-family="stamp.images"]:visible')
      .first()
      .click();
    const stampTool = (await snapshot(page)).tool;
    await enter(page);
    const stampPaper = (await page
      .locator(".kids-draw-overlay")
      .boundingBox())!;
    const sx = stampPaper.x + stampPaper.width / 2;
    const sy = stampPaper.y + stampPaper.height / 2;
    await page.touchscreen.tap(sx - 70, sy);
    await expect.poll(async () => (await snapshot(page)).shapes).toBe(2);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx, sy - 50, { steps: 8 });
    await page.mouse.move(sx + 50, sy);
    await page.mouse.up();
    await expect.poll(async () => (await snapshot(page)).shapes).toBe(3);
    expect((await snapshot(page)).tool).toBe(stampTool);
    const rotations = await page.evaluate(() =>
      Object.values((window as any).kidsDrawApp.store.getDocument().shapes).map(
        (s: any) => s.transform.rotation,
      ),
    );
    expect(rotations.some((r) => Math.abs(r - Math.PI / 2) < 0.1)).toBe(true);
    await exit(page, true);
    // Eraser is eligible, including its existing disabled color semantics.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-tool-family="eraser"]:visible').first().click();
    const eraser = (await snapshot(page)).tool;
    await enter(page);
    expect((await snapshot(page)).tool).toBe(eraser);
    await expect(page.locator(".ds-color-picker__swatch:visible")).toHaveCount(
      12,
    );
    await exit(page, true);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Menu", exact: true }),
    ).toBeVisible();
    await expect.poll(async () => (await snapshot(page)).shapes).toBe(3);
    await expect(page.locator(".ds-splat-context__scene--focused")).toHaveCount(
      0,
    );
    // Coloring pages retain their own dimensions and disabled fill size control.
    await page.goto(
      `${origin}/draw/?new=coloring&page=coloring%2Fpavelkukov%2Fcartoon_frog.svg`,
    );
    await expect(page.locator(".kids-draw-frame")).toHaveAttribute(
      "data-loading",
      "false",
      { timeout: 30000 },
    );
    const coloring = await snapshot(page);
    await page.locator('[data-tool-family="fill"]:visible').first().click();
    await enter(page);
    await expect(
      page.getByRole("button", { name: "Bigger", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".ds-color-picker__swatch:visible")).toHaveCount(
      12,
    );
    expect((await snapshot(page)).size).toEqual(coloring.size);
    expect((await snapshot(page)).resolution).toEqual(coloring.resolution);
    await page.screenshot({ path: `/tmp/toddler-${name}-coloring.png` });
    await exit(page, true);
    console.log(
      `[${name}] toddler mode: palette, size, tool lock, exit, outside-start, controls, persistence`,
    );
  } finally {
    await context.close();
  }
}
