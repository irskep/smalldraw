import { expect, type Browser } from "@playwright/test";
import { COLORING_TOPICS, getPortalMetadata } from "@smalldraw/shared";
import { getColoringCategories } from "@smalldraw/splat/coloring";

export async function checkColoringTopics(
  browser: Browser,
  origin: string,
  name: string,
) {
  const categories = getColoringCategories();
  const context = await browser.newContext();
  try {
    // Every topic's real curated artwork is present in the HTTP response.
    for (const topic of COLORING_TOPICS) {
      const response = await context.request.get(
        `${origin}/coloringbook/${topic.id}`,
      );
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain(`<h1>${topic.heading}</h1>`);
      const ids = [...html.matchAll(/data-coloring-page="([^"]+)"/g)].map(
        (match) => match[1],
      );
      expect(new Set(ids)).toEqual(
        new Set(
          categories
            .find((category) => category.id === topic.id)!
            .pages.map((page) => page.id),
        ),
      );
    }
    for (const width of [1280, 390]) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 850 });
      await page.goto(`${origin}/coloringbook/dinosaurs`);
      await expect(
        page.getByRole("heading", {
          name: "Dinosaur coloring pages",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page).toHaveTitle(
        getPortalMetadata("/coloringbook/dinosaurs").title,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://splatterboard.app/coloringbook/dinosaurs",
      );
      const allowed = new Set(
        categories
          .find((category) => category.id === "dinosaurs")!
          .pages.map((page) => page.id),
      );
      for (let i = 0; i < 4; i++) {
        await page
          .getByRole("button", { name: "Pick a random coloring page" })
          .click();
        expect(
          allowed.has(
            (await page
              .locator(".coloringbook__random a")
              .getAttribute("data-coloring-page"))!,
          ),
        ).toBe(true);
      }
      await page
        .locator(".coloringbook__subjects")
        .getByRole("link", { name: "Food", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Food coloring pages", exact: true }),
      ).toBeVisible();
      const food = new Set(
        categories
          .find((category) => category.id === "food")!
          .pages.map((page) => page.id),
      );
      expect(
        food.has(
          (await page
            .locator(".coloringbook__random a")
            .getAttribute("data-coloring-page"))!,
        ),
      ).toBe(true);
      await expect
        .poll(() =>
          page
            .locator(".coloringbook__random img")
            .evaluate(
              (image: HTMLImageElement) =>
                image.complete && image.naturalWidth > 0,
            ),
        )
        .toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/coloring-topic-${name}-${width}.png`,
      });
      await page.goBack();
      await expect(
        page.getByRole("heading", {
          name: "Dinosaur coloring pages",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "All coloring pages", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Free coloring book", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("heading", { name: "Animals", exact: true })
        .getByRole("link")
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Animal coloring pages",
          exact: true,
        }),
      ).toBeVisible();
      await page.close();
    }
    console.log(
      `PASS coloring topics ${name}: all HTML collections, scoped dice, metadata, navigation, mobile layout`,
    );
  } finally {
    await context.close();
  }
}
