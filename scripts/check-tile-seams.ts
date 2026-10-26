import { expect, type Browser } from "@playwright/test";
import { createCanvas, loadImage } from "canvas";

export async function checkTileSeams(browser: Browser, name: string) {
  const build = await Bun.build({
    entrypoints: [
      new URL("./fixtures/tile-seams.ts", import.meta.url).pathname,
    ],
    target: "browser",
  });
  if (!build.success)
    throw new Error(`Tile fixture build failed: ${build.logs.join("\n")}`);
  const script = await build.outputs[0].text();
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({
      viewport: { width: 900, height: 700 },
      deviceScaleFactor: dpr,
    });
    try {
      const page = await context.newPage();
      await page.setContent(
        "<!doctype html><body style='margin:0;background:white'></body>",
      );
      await page.addScriptTag({ content: script });
      for (const width of [631, 480, 719])
        for (const alpha of [1, 0.5]) {
          await page.evaluate(
            ({ width, alpha }) =>
              (window as any).paintTileFixture(width, alpha),
            { width, alpha },
          );
          const box = (await page.locator("#tile-test-frame").boundingBox())!;
          const screenshot = await page.screenshot({
            clip: {
              x: box.x + 5,
              y: box.y + 5,
              width: box.width - 10,
              height: box.height - 10,
            },
          });
          const image = await loadImage(screenshot);
          const canvas = createCanvas(image.width, image.height);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0);
          const { data } = ctx.getImageData(0, 0, image.width, image.height);
          for (const [channel, value] of [102, 194, 38].entries()) {
            expect(
              Math.abs(data[channel] - (value * alpha + 255 * (1 - alpha))),
            ).toBeLessThanOrEqual(1);
          }
          let seams = 0;
          for (let i = 4; i < data.length; i += 4) {
            if (
              data[i] !== data[0] ||
              data[i + 1] !== data[1] ||
              data[i + 2] !== data[2] ||
              data[i + 3] !== 255
            )
              seams++;
          }
          expect(
            seams,
            `${name} DPR ${dpr}, width ${width}, opacity ${alpha}`,
          ).toBe(0);
        }
    } finally {
      await context.close();
    }
  }
  console.log(
    `PASS ${name}: no tile seams at fractional scales, DPR 1/2, opaque/translucent paint, and resize`,
  );
}
