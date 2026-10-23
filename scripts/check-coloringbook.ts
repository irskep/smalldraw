import { expect, type Browser } from "@playwright/test";

export async function checkColoringbookNavigation(
  browser: Browser,
  origin: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  try {
    await page.goto(origin);
    const link = page.getByRole("link", {
      name: "Pick a coloring page",
      exact: true,
    });
    await expect(link).toBeVisible();
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "script") await scriptsReady;
      await route.continue();
    });
    const documentResponse = page.waitForResponse(
      (response) =>
        response.request().resourceType() === "document" &&
        new URL(response.url()).pathname === "/coloringbook",
    );
    await link.click({ noWaitAfter: true });
    expect((await documentResponse).status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Free coloring book" }),
    ).toBeVisible();
    await expect(page.locator(".coloringbook__pages").first()).toBeVisible();
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
  } finally {
    releaseScripts();
    await context.close();
  }
}

export async function checkColoringbook(
  browser: Browser,
  origin: string,
  name: string,
) {
  await checkColoringbookNavigation(browser, origin);
  for (const width of [1280, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 850 },
    });
    const page = await context.newPage();
    try {
      // The whole gallery must be usable before any client JavaScript arrives.
      let releaseScripts!: () => void;
      const scriptsReady = new Promise<void>((resolve) => {
        releaseScripts = resolve;
      });
      await page.route("**/*", async (route) => {
        if (route.request().resourceType() === "script") await scriptsReady;
        await route.continue();
      });
      await page.goto(`${origin}/coloringbook`, { waitUntil: "commit" });
      try {
        await expect(
          page.getByRole("heading", { name: "Free coloring book" }),
        ).toBeVisible();
        await expect(
          page.locator("#public-domain-review [data-coloring-page]").last(),
        ).toBeAttached();
        await expect(page.locator(".coloringbook__pages").first()).toHaveCSS(
          "display",
          "grid",
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        // Tiny Lucide pip paths are invisible with SVG's default butt linecaps.
        // Verify the server-rendered icon before hydration can repair attributes.
        const dice = page.locator(".coloringbook__dice svg");
        await expect(dice).toHaveCSS("stroke-linecap", "round");
        await expect(dice.locator("path")).toHaveCount(5);
        const firstImage = page.locator(".coloringbook__pages img").first();
        const firstCard = page.locator("[data-coloring-page]").first();
        const imageBox = await firstImage.boundingBox();
        const cardBox = await firstCard.boundingBox();
        expect(imageBox!.width).toBeLessThanOrEqual(cardBox!.width);
        expect(imageBox!.height).toBeLessThanOrEqual(cardBox!.height);
        await page.evaluate(() => {
          document
            .querySelector("[data-coloring-page]")!
            .setAttribute("data-before-hydration", "true");
        });
      } finally {
        releaseScripts();
      }
      await expect(
        page.getByRole("button", { name: "Menu", exact: true }),
      ).toBeVisible();
      // Hydration must retain the existing cards, not rebuild the gallery.
      await expect(page.locator('[data-before-hydration="true"]')).toHaveCount(
        1,
      );
      await page.unroute("**/*");
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
      const randomCard = page.locator(
        ".coloringbook__random [data-coloring-page]",
      );
      for (let roll = 0; roll < 3; roll++) {
        const previous = await randomCard.getAttribute("data-coloring-page");
        await page
          .getByRole("button", {
            name: "Pick a random coloring page",
            exact: true,
          })
          .click();
        await expect(randomCard).not.toHaveAttribute(
          "data-coloring-page",
          previous!,
        );
        const selected = await randomCard.getAttribute("data-coloring-page");
        expect(
          new URL((await randomCard.getAttribute("href"))!).searchParams.get(
            "page",
          ),
        ).toBe(selected);
        await expect
          .poll(() =>
            randomCard
              .locator("img")
              .evaluate(
                (image: HTMLImageElement) =>
                  image.complete && image.naturalWidth > 0,
              ),
          )
          .toBe(true);
      }
      await page
        .locator(".coloringbook__random")
        .screenshot({ path: `/tmp/coloringbook-random-${name}-${width}.png` });
      await page
        .locator(".coloringbook__subjects")
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
        '.coloringbook__pages [data-coloring-page="coloring/pavelkukov/dove.svg"]',
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
      await page.waitForURL(/\/draw\/[A-Za-z0-9_-]{20,}\/?$/);
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
      await page.waitForURL(/\/draw\/[A-Za-z0-9_-]{20,}\/?$/);
      expect(page.url()).not.toBe(firstUrl);
      await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
      await expect.poll(state).toEqual({
        reference: "coloring/pavelkukov/dove.svg",
        count: 0,
        tool: "fill.basic",
      });
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page
        .getByRole("menuitem", { name: "Your drawings", exact: true })
        .click();
      const drawingPreview = page
        .locator(".kids-draw-document-browser-dialog__thumbnail-media img")
        .first();
      await expect(drawingPreview).toBeVisible();
      await expect(drawingPreview).toHaveCSS("object-fit", "contain");
      await expect
        .poll(() =>
          drawingPreview.evaluate((image) => {
            const imageBox = image.getBoundingClientRect();
            const frame = image.closest("button")!.getBoundingClientRect();
            return (
              imageBox.width <= frame.width && imageBox.height <= frame.height
            );
          }),
        )
        .toBe(true);
      console.log(
        `PASS coloringbook ${name} ${width}: selected page, fill, reload, fresh copy`,
      );
    } finally {
      await context.close();
    }
  }
}
