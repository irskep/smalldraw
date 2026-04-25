import { expect, test } from "@playwright/test";

test("renders the default story", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Icon Button" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fill" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Option A" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("paginates to the selected grid item", async ({ page }) => {
  await page.goto("/#paged-button-grid");
  await expect(page.getByRole("heading", { name: "Paged Button Grid" })).toBeVisible();
  await page.getByRole("button", { name: "Show Last Item" }).click();
  await expect(page.getByRole("button", { name: "Row D" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
});
