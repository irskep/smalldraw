import { resolve } from "node:path";

import { chromium, expect } from "@playwright/test";
import { $ } from "bun";

import type { KidsDrawApp } from "../packages/splat/src/createKidsDrawApp";

// Capture real fills and UI, using the same palette controls as a person coloring.
const origin = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 760 },
    deviceScaleFactor: 2,
  });
  await page.goto(
    `${origin}/draw/?new=coloring&page=coloring%2Fpavelkukov%2Fcartoon_frog.svg`,
  );
  await page.waitForURL(/local=/);
  await page.waitForFunction(() =>
    Boolean((window as Window & { kidsDrawApp: KidsDrawApp }).kidsDrawApp),
  );
  const paper = page.locator(".kids-draw-frame");
  await expect(paper).toBeVisible();
  await page.waitForTimeout(800);
  const count = () =>
    page.evaluate(
      () =>
        Object.keys(
          (
            window as Window & { kidsDrawApp: KidsDrawApp }
          ).kidsDrawApp.store.getDocument().shapes,
        ).length,
    );
  for (const [color, x, y] of [
    ["Lime", 0.5, 0.5],
    ["Mint", 0.835, 0.81],
    ["Sunshine", 0.05, 0.05],
  ] as const) {
    await page.getByRole("button", { name: "Colors", exact: true }).click();
    await page
      .locator(`[data-setting="stroke-color"][aria-label="${color}"]`)
      .click();
    const before = await count();
    const box = (await paper.boundingBox())!;
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    await expect.poll(count).toBe(before + 1);
  }
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Colors", exact: true }).click();
  await expect(
    page.locator('[data-setting="stroke-color"][aria-label="Lime"]'),
  ).toBeVisible();
  await page.waitForTimeout(250);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1090, 750);
  const png = await page.screenshot();
  // Keep PNG for social previews; serve lossless WebP on the gallery itself.
  const pngPath = resolve(
    import.meta.dir,
    "../apps/app/public/coloringbook-preview.png",
  );
  await Bun.write(pngPath, png);
  const output = resolve(
    import.meta.dir,
    "../apps/app/public/coloringbook-preview.webp",
  );
  await $`cwebp -quiet -lossless ${pngPath} -o ${output}`;
} finally {
  await browser.close();
}
