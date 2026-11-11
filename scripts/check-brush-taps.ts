import { expect, type Browser } from "@playwright/test";
import { createCanvas, loadImage } from "canvas";

/** Pixel checks: saving a one-point shape does not guarantee it is painted. */
export async function checkBrushTaps(browser: Browser, origin: string) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
  });
  try {
    await page.goto(`${origin}/draw/?new=blank`);
    await expect(
      page.getByRole("button", { name: "Bigger", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() =>
      (window as any).kidsDrawApp.store.updateSharedSettings({
        strokeWidth: 24,
        strokeColor: "#000000",
      }),
    );
    const box = (await page.locator(".kids-draw-frame").boundingBox())!;
    const marks: { x: number; y: number }[] = [];
    const ink = async (point: { x: number; y: number }) => {
      const png = await page.screenshot({
        clip: { x: point.x - 20, y: point.y - 20, width: 40, height: 40 },
      });
      const image = await loadImage(png);
      const canvas = createCanvas(40, 40),
        ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, 40, 40);
      const pixels = ctx.getImageData(0, 0, 40, 40).data;
      let dark = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 240) dark++;
      return dark;
    };
    for (const [index, tool] of [
      "brush.marker",
      "brush.freehand",
      "brush.even-spraycan",
      "brush.uneven-spraycan",
    ].entries()) {
      await page.locator(`[data-tool-variant="${tool}"]:visible`).click();
      for (const touch of [false, true]) {
        const point = {
          x: Math.round(box.x + 100 + index * 120),
          y: Math.round(box.y + 100 + (touch ? 100 : 0)),
        };
        if (touch) await page.touchscreen.tap(point.x, point.y);
        else await page.mouse.click(point.x, point.y);
        await page.mouse.move(5, 5);
        await expect
          .poll(() => ink(point), {
            message: `${tool} ${touch ? "touch" : "mouse"} dot`,
          })
          .toBeGreaterThan(5);
        marks.push(point);
      }
    }
    // Erasing a dot should remove it immediately and remain erased after reload.
    await page.locator('[data-tool-family="eraser"]:visible').first().click();
    await page.evaluate(() =>
      (window as any).kidsDrawApp.store.updateSharedSettings({
        strokeWidth: 48,
      }),
    );
    await page.mouse.click(marks[0].x, marks[0].y);
    await page.mouse.move(5, 5);
    await expect.poll(() => ink(marks[0])).toBe(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Bigger", exact: true }),
    ).toBeEnabled();
    await expect.poll(() => ink(marks[0])).toBe(0);
    for (const point of marks.slice(1))
      await expect.poll(() => ink(point)).toBeGreaterThan(5);
    console.log(
      `PASS ${browser.browserType().name()}: mouse/touch brush dots, eraser taps, reload pixels`,
    );
  } finally {
    await page.close();
  }
}
