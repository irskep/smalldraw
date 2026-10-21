import { expect, type Page } from "@playwright/test";

export async function checkStampInteraction(source: Page, browserName: string) {
  const context = await source.context().browser()!.newContext();
  try {
    const page = await context.newPage();
    await page.goto(new URL("/draw/?new=1", source.url()).href);
    await page.waitForURL(/local=/);
    await expect(page.locator(".kids-draw-frame")).toBeVisible();
    await exerciseStamps(page, browserName);
  } finally {
    await context.close();
  }
}

async function exerciseStamps(page: Page, browserName: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const family of ["stamp.images", "stamp.alphabet"]) {
    await page
      .locator(`[data-tool-family="${family}"]:visible`)
      .first()
      .click();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(200);
      const paper = page.locator(".kids-draw-frame");
      const before = await paper.boundingBox();
      const preview = page.locator(".ds-tool-state-preview:visible > *");
      const drawingHeight = await page.evaluate(
        () => (window as any).kidsDrawApp.store.getDocument().size.height,
      );
      let small = 0;
      let previousWidth = 0;
      for (const size of [2, 4, 8, 16, 24, 48, 96, 200]) {
        await page.evaluate((size) => {
          (window as any).kidsDrawApp.store.updateSharedSettings({
            strokeWidth: size,
          });
        }, size);
        await page.waitForTimeout(100);
        expect(await paper.boundingBox()).toEqual(before);
        const box = (await preview.boundingBox())!;
        if (size === 2) small = box.width;
        expect(box.width).toBeGreaterThan(previousWidth);
        previousWidth = box.width;
        expect(box.width / small).toBeCloseTo(
          (drawingHeight / Math.min(30, drawingHeight / 4)) **
            (Math.log(size / 2) / Math.log(100)),
          1,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        // Overflow is visual only: the neighboring controls remain clickable.
        await expect(
          page.getByRole("button", { name: "Randomize", exact: true }),
        ).toBeInViewport();
      }
      await page.screenshot({
        path: `/tmp/stamp-overflow-${browserName}-${family}-${width}.png`,
      });
      await page
        .getByRole("button", { name: "Randomize", exact: true })
        .click();
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() =>
      (window as any).kidsDrawApp.store.updateSharedSettings({
        strokeWidth: 8,
      }),
    );
    const box = (await page.locator(".kids-draw-frame").boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const shapes = () =>
      page.evaluate(
        () =>
          Object.values(
            (window as any).kidsDrawApp.store.getDocument().shapes,
          ) as any[],
      );
    const previousIds = new Set((await shapes()).map((shape) => shape.id));
    const count = previousIds.size;
    // Start upward, then turn clockwise. No assumed rightward handle.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 50, { steps: 8 });
    await page.mouse.move(x + 50, y);
    await page.mouse.up();
    await expect.poll(async () => (await shapes()).length).toBe(count + 1);
    const stamp = (await shapes()).find((shape) => !previousIds.has(shape.id));
    expect(stamp.transform.scale).toEqual([1, 1]);
    expect(stamp.transform.rotation).toBeCloseTo(Math.PI / 2, 1);
    expect(
      family === "stamp.alphabet"
        ? stamp.geometry.height
        : Math.max(stamp.geometry.width, stamp.geometry.height),
    ).toBeCloseTo(
      await page.evaluate(() => {
        const height = (window as any).kidsDrawApp.store.getDocument().size
          .height;
        const minimum = Math.min(30, height / 4);
        return minimum * (height / minimum) ** (Math.log(4) / Math.log(100));
      }),
    );
    await page.evaluate(() =>
      (window as any).kidsDrawApp.store.updateSharedSettings({
        strokeWidth: 200,
      }),
    );
    const beforeLarge = new Set((await shapes()).map((shape) => shape.id));
    await page.mouse.click(x, y);
    await expect
      .poll(async () => (await shapes()).length)
      .toBe(beforeLarge.size + 1);
    const large = (await shapes()).find((shape) => !beforeLarge.has(shape.id));
    const height = await page.evaluate(
      () => (window as any).kidsDrawApp.store.getDocument().size.height,
    );
    expect(
      family === "stamp.alphabet"
        ? large.geometry.height
        : Math.max(large.geometry.width, large.geometry.height),
    ).toBeLessThanOrEqual(height);
    await page.evaluate(() =>
      (window as any).kidsDrawApp.store.updateSharedSettings({
        strokeWidth: 8,
      }),
    );
    await page.screenshot({
      path: `/tmp/stamp-rotation-${browserName}-${family}.png`,
    });
  }
  console.log(
    `PASS: ${browserName} stamp size, directional rotation, proportional overflow, stable canvas, clickable controls`,
  );
}
