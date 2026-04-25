import { expect, test } from "@playwright/test";

test("renders the default story", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Button Tones" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Primary" })).toBeVisible();
});
