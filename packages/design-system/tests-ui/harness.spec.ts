import { expect, test } from "@playwright/test";

function testStoryUrl(storyId: string): string {
  return `/?test-story=${storyId}`;
}

// ---------------------------------------------------------------------------
// Icon Button
// ---------------------------------------------------------------------------

test("renders the default story", async ({ page }) => {
  await page.goto(testStoryUrl("icon-button"));
  await expect(page.getByRole("heading", { name: "Icon Button" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fill" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Option A" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("renders the Open Props reference story", async ({ page }) => {
  await page.goto(testStoryUrl("open-props-reference"));
  await expect(
    page.getByRole("heading", { name: "Open Props Reference" }),
  ).toBeVisible();
  await expect(page.getByText("--size-2")).toBeVisible();
  await expect(page.getByText("--shadow-3")).toBeVisible();
});

test("renders the splat context story", async ({ page }) => {
  await page.goto(testStoryUrl("splat-context"));
  await expect(page.getByRole("heading", { name: "Splat Context" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Desktop" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mobile Portrait" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actions" }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// Grid: Pagination
// ---------------------------------------------------------------------------

test.describe("Grid: Pagination", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("grid-pagination"));
    await expect(page.getByRole("heading", { name: "Grid: Pagination" })).toBeVisible();
  });

  test("shows first page with prev disabled and next enabled", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  test("navigates forward and back via nav buttons", async ({ page }) => {
    const next = page.getByRole("button", { name: "Next page" });
    const prev = page.getByRole("button", { name: "Previous page" });

    // Go forward — Pencil should disappear, later items should appear
    await next.click();
    await expect(page.getByRole("button", { name: "Pencil" })).not.toBeVisible();
    await expect(prev).toBeEnabled();

    // Go back — Pencil should reappear
    await prev.click();
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
    await expect(prev).toBeDisabled();
  });

  test("jumping to last item pages to the final page", async ({ page }) => {
    await page.getByRole("button", { name: "Last" }).click();
    await expect(page.getByRole("button", { name: "Rows" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  test("jumping to middle item shows that item", async ({ page }) => {
    await page.getByRole("button", { name: "Middle" }).click();
    // The middle item (index 6) is "Circle"
    await expect(page.getByRole("button", { name: "Circle" })).toBeVisible();
  });

  test("jumping to first from last pages back to start", async ({ page }) => {
    await page.getByRole("button", { name: "Last" }).click();
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
    await page.getByRole("button", { name: "First" }).click();
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  test("clicking a grid item selects it", async ({ page }) => {
    const fill = page.getByRole("button", { name: "Fill" });
    await fill.click();
    await expect(fill).toHaveAttribute("aria-pressed", "true");
    // Previously selected item should be deselected
    await expect(page.getByRole("button", { name: "Pencil" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

// ---------------------------------------------------------------------------
// Grid: Mode Switching
// ---------------------------------------------------------------------------

test.describe("Grid: Mode Switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("grid-mode-switching"));
    await expect(page.getByRole("heading", { name: "Grid: Mode Switching" })).toBeVisible();
  });

  test("starts in mobile mode with pagination", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
    // Not all items visible — pagination is active
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
  });

  test("switching to large mode shows all items without pagination", async ({ page }) => {
    await page.getByRole("button", { name: "large" }).click();
    // All 12 items should be visible
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rows" })).toBeVisible();
    // Nav buttons should be hidden
    await expect(page.getByRole("button", { name: "Previous page" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Next page" })).toBeHidden();
  });

  test("switching from large back to mobile restores pagination", async ({ page }) => {
    await page.getByRole("button", { name: "large" }).click();
    await expect(page.getByRole("button", { name: "Rows" })).toBeVisible();

    await page.getByRole("button", { name: "mobile" }).click();
    await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
    // Last item should no longer be visible (paginated away)
    await expect(page.getByRole("button", { name: "Rows" })).not.toBeVisible();
  });

  test("switching to medium mode still paginates", async ({ page }) => {
    await page.getByRole("button", { name: "medium" }).click();
    await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Grid: Dynamic Items
// ---------------------------------------------------------------------------

test.describe("Grid: Dynamic Items", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("grid-dynamic-items"));
    await expect(page.getByRole("heading", { name: "Grid: Dynamic Items" })).toBeVisible();
  });

  test("adding an item increases the count", async ({ page }) => {
    await expect(page.getByText("Items: 12")).toBeVisible();
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("Items: 13")).toBeVisible();
  });

  test("removing all but one item hides nav buttons", async ({ page }) => {
    const remove = page.getByRole("button", { name: "Remove last" });
    for (let i = 0; i < 11; i++) {
      await remove.click();
    }
    await expect(page.getByText("Items: 1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Next page" })).toBeHidden();
  });

  test("reset restores the original item set", async ({ page }) => {
    await page.getByRole("button", { name: "Remove last" }).click();
    await expect(page.getByText("Items: 11")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText("Items: 12")).toBeVisible();
  });

  test("added items are reachable by paging forward", async ({ page }) => {
    // Add a few items
    const add = page.getByRole("button", { name: "Add item" });
    await add.click();
    await add.click();

    // Page to the end
    const next = page.getByRole("button", { name: "Next page" });
    while (await next.isEnabled()) {
      await next.click();
    }
    // One of the new items should be visible on the last page
    await expect(page.getByRole("button", { name: /New \d+/ }).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Grid: Vertical
// ---------------------------------------------------------------------------

test.describe("Grid: Vertical", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("grid-vertical"));
    await expect(page.getByRole("heading", { name: "Grid: Vertical" })).toBeVisible();
    // Wait for rAF-based layout to settle
    await page.waitForTimeout(100);
  });

  test("paginates vertically with nav buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  test("jump to last navigates to final page", async ({ page }) => {
    await page.getByRole("button", { name: "Jump to last" }).click();
    await expect(page.getByRole("button", { name: "Rows" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Grid: Two-Row
// ---------------------------------------------------------------------------

test.describe("Grid: Two-Row", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("grid-two-row"));
    await expect(page.getByRole("heading", { name: "Grid: Two-Row" })).toBeVisible();
  });

  test("large mode shows all items without pagination", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rows" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Next page" })).toBeHidden();
  });

  test("large mode shell grows to contain all visible items", async ({ page }) => {
    const clipped = await page.evaluate(() => {
      const shell = document.querySelector(".button-grid-shell");
      const items = Array.from(document.querySelectorAll(".button-grid-item"));
      if (!shell || items.length === 0) return true;
      const shellRect = shell.getBoundingClientRect();
      return items.some((item) => {
        const rect = item.getBoundingClientRect();
        return rect.right > shellRect.right + 2 || rect.bottom > shellRect.bottom + 2;
      });
    });
    expect(clipped).toBe(false);
  });

  test("switching to mobile paginates to single row", async ({ page }) => {
    await page.getByRole("button", { name: "mobile" }).click();
    await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
    // Not all items visible
    await expect(page.getByRole("button", { name: "Rows" })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Grid: Two-Row XLarge
// ---------------------------------------------------------------------------

test.describe("Grid: Two-Row XLarge", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("grid-two-row-xlarge"));
    await expect(
      page.getByRole("heading", { name: "Grid: Two-Row XLarge" }),
    ).toBeVisible();
  });

  test("paginates in large mode with doubled cell size", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
    // With doubled cells in a constrained frame, pagination should be active
    await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  test("navigating forward reveals more items", async ({ page }) => {
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByRole("button", { name: "Pencil" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  test("visible items are not clipped by nav buttons", async ({ page }) => {
    // Regression: nav buttons previously inherited doubled cell size, clipping items
    const clipped = await page.evaluate(() => {
      const viewport = document.querySelector(".button-grid-viewport");
      const items = document.querySelectorAll(".button-grid-item");
      if (!viewport || items.length === 0) return true;
      const vpRect = viewport.getBoundingClientRect();
      for (const item of items) {
        const r = item.getBoundingClientRect();
        if (r.right > vpRect.right + 2 || r.bottom > vpRect.bottom + 2) return true;
      }
      return false;
    });
    expect(clipped).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Grid: Vertical Two-Column
// ---------------------------------------------------------------------------

test.describe("Grid: Vertical Two-Column", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("grid-vertical-two-col"));
    await expect(
      page.getByRole("heading", { name: "Grid: Vertical Two-Column" }),
    ).toBeVisible();
  });

  test("large mode shows all items in two columns without pagination", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Pencil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rows" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeHidden();
  });

  test("large mode grid does not overflow its container", async ({ page }) => {
    // Regression: grid with fixed height overflowed in large mode
    const overflows = await page.evaluate(() => {
      const stage = document.querySelector(".ds-harness__stage");
      const grid = document.querySelector(".button-grid");
      if (!stage || !grid) return true;
      const stageRect = stage.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      return gridRect.bottom > stageRect.bottom + 2;
    });
    expect(overflows).toBe(false);
  });

  test("switching to mobile shows single-column paginated", async ({ page }) => {
    await page.getByRole("button", { name: "mobile" }).click();
    // Wait for rAF layout
    await page.waitForTimeout(100);
    await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

test.describe("Button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("button"));
    await expect(page.getByRole("heading", { name: "Button" })).toBeVisible();
  });

  test("renders all three tone variants", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" }).first()).toBeVisible();
  });

  test("renders buttons with icons", async ({ page }) => {
    // Buttons with icons should have visible SVG elements
    const deleteWithIcon = page.getByRole("button", { name: "Delete" }).nth(1);
    await expect(deleteWithIcon).toBeVisible();
    await expect(deleteWithIcon.locator("svg")).toBeVisible();
  });

  test("disabled buttons are not interactive", async ({ page }) => {
    const disabled = page.getByRole("button", { name: "Disabled" }).first();
    await expect(disabled).toBeDisabled();
  });

  test("click handler fires on press", async ({ page }) => {
    await page.getByRole("button", { name: "Click Me" }).click();
    await expect(page.getByText("Button clicked.")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Dropdown Menu
// ---------------------------------------------------------------------------

test.describe("Dropdown Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("dropdown-menu"));
    await expect(page.getByRole("heading", { name: "Dropdown Menu" })).toBeVisible();
  });

  test("opens and renders mobile action menu items", async ({ page }) => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("menu", { name: "Actions" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Undo" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Redo" })).toBeDisabled();
    await expect(page.getByRole("menuitem", { name: "Clear Canvas" })).toBeVisible();
  });

  test("selecting an item updates the story status", async ({ page }) => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("menuitem", { name: "Export PNG" }).click();
    await expect(page.getByText("Selected: export")).toBeVisible();
  });

  test("clicking outside closes the menu", async ({ page }) => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("menu", { name: "Actions" })).toBeVisible();
    await page.getByRole("heading", { name: "Dropdown Menu" }).click();
    await expect(page.getByRole("menu", { name: "Actions" })).toBeHidden();
  });

  test("pressing Escape closes the menu", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Actions" });
    await trigger.click();
    await expect(page.getByRole("menu", { name: "Actions" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Actions" })).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
