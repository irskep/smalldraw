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
  await expect(
    page.getByRole("heading", { name: "Splat Context" }),
  ).toBeVisible();
  await expect(page.locator(".ds-splat-context__scene").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu" }).first()).toBeVisible();
});

test.describe("Unified context entry stories", () => {
  test("desktop-context starts in desktop layout", async ({ page }) => {
    await page.goto(testStoryUrl("desktop-context"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });
    await expect(page.getByRole("heading", { name: "Desktop" })).toBeVisible();
    await expect(
      page.locator(".ds-splat-context__scene--desktop").first(),
    ).toBeVisible();
  });

  test("mobile-portrait starts in portrait layout", async ({ page }) => {
    await page.goto(testStoryUrl("mobile-portrait"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });
    await expect(
      page.getByRole("heading", { name: "Mobile Portrait" }),
    ).toBeVisible();
    await expect(
      page.locator(".ds-splat-context__scene--mobile").first(),
    ).toBeVisible();
    await expect(
      page.locator(".ds-splat-context__scene--mobile-responsive").first(),
    ).toBeVisible();
    await expect(
      page.locator(".ds-splat-context__scene--mobile-responsive").first(),
    ).toHaveAttribute("data-mobile-layout", "mobile-standard");
  });

  test("mobile-landscape starts in short landscape layout", async ({ page }) => {
    await page.goto(testStoryUrl("mobile-landscape"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });
    await expect(
      page.getByRole("heading", { name: "Mobile Landscape" }),
    ).toBeVisible();
    const scene = page.locator(".ds-splat-context__scene--mobile-responsive").first();
    await expect(scene).toBeVisible();
    await expect(scene).toHaveAttribute(
      "data-mobile-layout",
      "mobile-landscape-short",
    );
  });

  test("mobile layouts show Share once width reaches 480px", async ({ page }) => {
    await page.goto(testStoryUrl("mobile-portrait"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });
    const frame = page.locator(".ds-splat-context__frame").first();
    const shareButton = page.locator(
      ".ds-splat-context__mobile-trailing-actions > .ds-button",
    );

    await expect(shareButton).toHaveAttribute("hidden", "");

    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "480px";
      target.style.height = "500px";
    });

    await expect(
      page.locator(".ds-splat-context__scene--mobile").first(),
    ).toBeVisible();
    await expect(shareButton).toBeVisible();

    const shareMetrics = await shareButton.evaluate((element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(shareMetrics.width).toBeGreaterThan(0);
    expect(shareMetrics.height).toBeGreaterThan(0);
  });

  test("mobile-portrait bottom toolbar paginates at narrow widths", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("mobile-portrait"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });
    const frame = page.locator(".ds-splat-context__frame").first();
    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "260px";
    });

    const variantStrip = page.locator(".ds-splat-context__variant-strip").first();
    await variantStrip.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.setProperty(
        "--ds-splat-context-toolbar-cell-size",
        "72px",
      );
    });
    const next = variantStrip.getByRole("button", { name: "Next page" });
    await expect(next).toBeVisible();
    await expect(next).toBeEnabled();

    const overflowMetrics = await variantStrip.evaluate((element) => {
      const target = element as HTMLElement;
      return {
        clientWidth: target.clientWidth,
        scrollWidth: target.scrollWidth,
      };
    });
    expect(overflowMetrics.scrollWidth).toBeLessThanOrEqual(
      overflowMetrics.clientWidth,
    );
  });

  test("desktop bottom toolbar paginates even with larger button sizes", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("desktop-context"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });
    const frame = page.locator(".ds-splat-context__frame").first();
    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "600px";
      target.style.height = "640px";
    });
    const variantStrip = page.locator(".ds-splat-context__variant-strip").first();
    await variantStrip.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.setProperty(
        "--ds-splat-context-toolbar-bottom-cell-size",
        "160px",
      );
    });
    const metrics = await variantStrip.evaluate((element) => {
      const target = element as HTMLElement;
      const buttonGrid = target as HTMLElement;
      return {
        width: target.getBoundingClientRect().width,
        scrollWidth: target.scrollWidth,
        largeLayout: buttonGrid.getAttribute("data-large-layout"),
        paginateLarge: buttonGrid.getAttribute("data-paginate-large"),
      };
    });
    expect(metrics.largeLayout).toBe("single-row");
    expect(metrics.paginateLarge).toBe("false");
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
  });

  test("desktop bottom row height stays constant across brush and stamp families", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("desktop-context"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });

    const clickTool = async (label: string) => {
      await page
        .locator(".ds-splat-context__tool-selector")
        .getByRole("button", { name: label })
        .click();
    };
    const measureBottomSlotHeight = async () =>
      page.locator(".ds-splat-context__slot--bottom").evaluate((element) => {
        return (element as HTMLElement).getBoundingClientRect().height;
      });

    await clickTool("Brush");
    const brushHeight = await measureBottomSlotHeight();

    await clickTool("Letters");
    const lettersHeight = await measureBottomSlotHeight();

    await clickTool("Stamps");
    const stampsHeight = await measureBottomSlotHeight();

    expect(brushHeight).toBe(96);
    expect(lettersHeight).toBe(96);
    expect(stampsHeight).toBe(96);
  });

  test("resize handle shows live width and height", async ({ page }) => {
    await page.goto(testStoryUrl("mobile-portrait"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });

    const readout = page.locator(".ds-resize-handle__size").first();
    await expect(readout).toHaveText("384 x 640");

    const frame = page.locator(".ds-splat-context__frame").first();
    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "420px";
      target.style.height = "520px";
    });

    await expect(readout).toHaveText("420 x 520");
  });

  test("shared context control hosts with hidden state have no layout presence", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("desktop-context"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });

    const metrics = await page.evaluate(() => {
      const selectors = [
        ".ds-color-picker",
        ".ds-stroke-picker",
        ".ds-dropdown-menu",
        ".ds-sync-indicator",
        ".ds-toolbar",
      ] as const;

      return selectors.map((selector) => {
        const element = document.querySelector(selector) as HTMLElement | null;
        if (!element) {
          throw new Error(`Missing element for selector: ${selector}`);
        }

        const before = element.getBoundingClientRect();
        element.hidden = true;
        const after = element.getBoundingClientRect();

        return {
          selector,
          beforeWidth: before.width,
          beforeHeight: before.height,
          afterWidth: after.width,
          afterHeight: after.height,
          display: window.getComputedStyle(element).display,
        };
      });
    });

    for (const metric of metrics) {
      expect(metric.beforeWidth).toBeGreaterThan(0);
      expect(metric.beforeHeight).toBeGreaterThan(0);
      expect(metric.afterWidth).toBe(0);
      expect(metric.afterHeight).toBe(0);
      expect(metric.display).toBe("none");
    }
  });
});

test.describe("Combined Splat Context story", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("splat-context"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });
    await expect(
      page.getByRole("heading", { name: "Splat Context", level: 1 }),
    ).toBeVisible();
  });

  test("starts in desktop, then switches to mobile portrait and short landscape", async ({
    page,
  }) => {
    const frame = page.locator(".ds-splat-context__frame").first();
    const scene = page.locator(".ds-splat-context__scene").first();

    await expect(scene).toHaveClass(/ds-splat-context__scene--desktop/);

    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "384px";
      target.style.height = "640px";
    });
    await expect(scene).toHaveClass(/ds-splat-context__scene--mobile/);

    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "640px";
      target.style.height = "320px";
    });
    await expect(scene).toHaveAttribute(
      "data-mobile-layout",
      "mobile-landscape-short",
    );
  });

  test("mobile share stays hidden below 480px in the combined story", async ({
    page,
  }) => {
    const frame = page.locator(".ds-splat-context__frame").first();
    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "480px";
      target.style.height = "500px";
    });

    const mobileShare = page.locator(
      ".ds-splat-context__mobile-trailing-actions > .ds-button",
    );
    await expect(
      page.locator(".ds-splat-context__scene--mobile").first(),
    ).toBeVisible();
    await expect(mobileShare).toBeVisible();

    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "342px";
      target.style.height = "467px";
    });

    await expect(
      page.locator(".ds-splat-context__scene--mobile").first(),
    ).toBeVisible();
    await expect(mobileShare).toHaveAttribute("hidden", "");

    const shareMetrics = await mobileShare.evaluate((element) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(shareMetrics.width).toBe(0);
    expect(shareMetrics.height).toBe(0);
  });
});

test.describe("Mobile Landscape story", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("mobile-landscape"));
    await expect(
      page.getByRole("heading", { name: "Mobile Landscape", level: 1 }),
    ).toBeVisible();
  });

  test("starts in short landscape with dropdown tool picker visible", async ({
    page,
  }) => {
    const scene = page.locator(".ds-splat-context__scene--mobile-responsive");
    await expect(scene).toHaveAttribute(
      "data-mobile-layout",
      "mobile-landscape-short",
    );
    await expect(
      page.locator(".ds-splat-context__mobile-tool-inline-host"),
    ).toBeHidden();
    await expect(page.getByRole("button", { name: "Tools" })).toBeVisible();
  });

  test("taller landscape restores inline tool picker", async ({ page }) => {
    const frame = page.locator(".ds-splat-context__frame").first();
    const scene = page.locator(".ds-splat-context__scene--mobile-responsive");
    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "640px";
      target.style.height = "420px";
    });

    await expect(scene).toHaveAttribute("data-mobile-layout", "mobile-standard");
    await expect(
      page.locator(".ds-splat-context__mobile-tool-inline-host"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Tools" })).toBeHidden();
  });

  test("short landscape hides inline picker and shows dropdown picker", async ({
    page,
  }) => {
    const frame = page.locator(".ds-splat-context__frame").first();
    const scene = page.locator(".ds-splat-context__scene--mobile-responsive");
    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.width = "640px";
      target.style.height = "320px";
    });

    await expect(scene).toHaveAttribute(
      "data-mobile-layout",
      "mobile-landscape-short",
    );
    await expect(
      page.locator(".ds-splat-context__mobile-tool-inline-host"),
    ).toBeHidden();

    const toolsTrigger = page.getByRole("button", { name: "Tools" });
    await expect(toolsTrigger).toBeVisible();
    await toolsTrigger.click();
    await expect(
      page.locator(".ds-splat-context__tool-dropdown-panel"),
    ).toBeVisible();

    await page
      .locator(".ds-splat-context__tool-dropdown-panel")
      .getByRole("button", { name: "Fill", exact: true })
      .click();
    await expect(page.getByText("Tool: fill")).toBeVisible();

    await frame.evaluate((element) => {
      const target = element as HTMLElement;
      target.style.height = "420px";
    });
    await expect(scene).toHaveAttribute("data-mobile-layout", "mobile-standard");
    await expect(
      page.locator(".ds-splat-context__mobile-tool-inline-host"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fill" }).first(),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("short landscape actions menu stays within the viewport", async ({
    page,
  }) => {
    const menuTrigger = page.getByRole("button", { name: "Menu" }).first();
    await menuTrigger.click();

    const panel = page.locator(".ds-dropdown-menu__panel").first();
    await expect(panel).toBeVisible();

    const metrics = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
        scrollHeight: (element as HTMLElement).scrollHeight,
        clientHeight: (element as HTMLElement).clientHeight,
      };
    });

    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.scrollHeight).toBeGreaterThanOrEqual(metrics.clientHeight);
  });
});

test.describe("Splat Context pickers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testStoryUrl("splat-context"));
    await page.evaluate(() => {
      document.querySelector("bun-hmr")?.remove();
    });
    await expect(page.getByRole("heading", { name: "Splat Context" })).toBeVisible();
  });

  test("color picker closes when the mouse leaves the trigger and panel union", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: "Colors" }).first();
    const panel = page.getByRole("dialog", { name: "Color picker" }).first();
    await trigger.click();
    await expect(panel).toBeVisible();
    await page.mouse.move(4, 4);
    await expect(panel).toBeHidden();
  });

  test("stroke picker closes when the mouse leaves the trigger and panel union", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: "Strokes" }).first();
    const panel = page.getByRole("dialog", { name: "Stroke picker" }).first();
    await trigger.click();
    await expect(panel).toBeVisible();
    await page.mouse.move(4, 4);
    await expect(panel).toBeHidden();
  });
});

test.describe("Typography stories", () => {
  test("typographic icons with hidden state have no layout presence", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("text"));

    const metrics = await page.evaluate(() => {
      const element = document.querySelector(
        ".ds-typographic-icon",
      ) as HTMLElement | null;
      if (!element) {
        throw new Error("Missing typographic icon specimen");
      }

      const before = element.getBoundingClientRect();
      element.hidden = true;
      const after = element.getBoundingClientRect();

      return {
        beforeWidth: before.width,
        beforeHeight: before.height,
        afterWidth: after.width,
        afterHeight: after.height,
        display: window.getComputedStyle(element).display,
      };
    });

    expect(metrics.beforeWidth).toBeGreaterThan(0);
    expect(metrics.beforeHeight).toBeGreaterThan(0);
    expect(metrics.afterWidth).toBe(0);
    expect(metrics.afterHeight).toBe(0);
    expect(metrics.display).toBe("none");
  });
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
    await page.locator(".button-grid").evaluate((element) => {
      (element as HTMLElement).style.width = "260px";
    });
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

  test("items remain contained within the grid root height", async ({ page }) => {
    const overflows = await page.evaluate(() => {
      const grid = document.querySelector(".button-grid");
      const items = Array.from(document.querySelectorAll(".button-grid-item"));
      if (!grid || items.length === 0) return true;
      const gridRect = grid.getBoundingClientRect();
      return items.some((item) => {
        const rect = item.getBoundingClientRect();
        return (
          rect.left < gridRect.left - 2 ||
          rect.right > gridRect.right + 2 ||
          rect.top < gridRect.top - 2 ||
          rect.bottom > gridRect.bottom + 2
        );
      });
    });
    expect(overflows).toBe(false);
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

  test("items remain contained within the story frame width", async ({ page }) => {
    const overflows = await page.evaluate(() => {
      const frame = document.querySelector(".ds-story-frame");
      const items = Array.from(document.querySelectorAll(".button-grid-item"));
      if (!frame || items.length === 0) return true;
      const frameRect = frame.getBoundingClientRect();
      return items.some((item) => {
        const rect = item.getBoundingClientRect();
        return rect.left < frameRect.left - 2 || rect.right > frameRect.right + 2;
      });
    });
    expect(overflows).toBe(false);
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

test.describe("Dialog primitives", () => {
  test("dialog-scaffold story exposes centered header controls and body cards", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("dialog-scaffold"));
    await page.getByRole("button", { name: "Open scaffold" }).click();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Blank Drawing" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Coloring Book" }),
    ).toBeVisible();
  });

  test("dialog-scaffold story closes on Escape", async ({ page }) => {
    await page.goto(testStoryUrl("dialog-scaffold"));
    await page.getByRole("button", { name: "Open scaffold" }).click();
    await expect(page.locator("dialog.ds-harness-dialog-scaffold")).toHaveAttribute(
      "open",
      "",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.ds-harness-dialog-scaffold")).not.toHaveAttribute(
      "open",
      "",
    );
  });

  test("choice-card story renders enabled and disabled cards", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("choice-card"));
    await expect(
      page.getByRole("heading", { name: "Choice Card" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Blank Drawing" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Coloring Book 1" }),
    ).toBeDisabled();
  });

  test("poster-card story renders square page cards inside the grid", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("poster-card"));
    const firstCard = page.getByRole("button", { name: "Page 001" });
    await expect(firstCard).toBeVisible();
    const metrics = await firstCard.locator(".ds-poster-card__media").evaluate(
      (element) => {
        const rect = (element as HTMLElement).getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      },
    );
    expect(metrics.width).toBe(metrics.height);
  });

  test("coloring-book-picker story navigates from books to pages and back", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("coloring-book-picker"));
    await page.getByRole("button", { name: "Open book picker" }).click();
    await expect(
      page.getByRole("button", { name: "Blank Drawing" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "PDR Volume 1" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "PDR Volume 1" }).click();
    await expect(
      page.locator(".ds-dialog-scaffold__title"),
    ).toHaveText("PDR Volume 1");
    await expect(
      page.locator("h3").filter({ hasText: "PDR Volume 1" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Page 001" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Page 004" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(
      page.getByRole("button", { name: "Blank Drawing" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "PDR Volume 1" }),
    ).toBeVisible();
  });

  test("thumbnail-tile story renders overlay actions and status badges", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("thumbnail-tile"));
    await expect(page.getByText("Shared").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Claim drawing" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete drawing" }).first(),
    ).toBeVisible();
    await expect(page.getByText("Local").first()).toBeVisible();
  });

  test("preview-card story renders preview media and metadata", async ({
    page,
  }) => {
    await page.goto(testStoryUrl("preview-card"));
    await expect(page.getByText("Drawing abc123")).toBeVisible();
    await expect(
      page.getByText("Last opened: 1/1/2026, 12:00:00 AM"),
    ).toBeVisible();
    await expect(page.locator(".ds-preview-card__image")).toBeVisible();
  });
});

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
    await expect(deleteWithIcon.locator("svg").first()).toBeVisible();
  });

  test("primary and danger button labels inherit white text", async ({
    page,
  }) => {
    const primary = page.getByRole("button", { name: "Save" }).first();
    const danger = page.getByRole("button", { name: "Delete" }).first();

    const colors = await Promise.all(
      [primary, danger].map((button) =>
        button.locator(".ds-button__label").evaluate((element) =>
          window.getComputedStyle(element).color,
        ),
      ),
    );

    expect(colors).toEqual(["rgb(255, 255, 255)", "rgb(255, 255, 255)"]);
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

  test("moving the mouse within the trigger and menu union keeps the menu open", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: "Actions" });
    const menu = page.getByRole("menu", { name: "Actions" });
    await trigger.hover();
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.getByRole("menuitem", { name: "Export PNG" }).hover();
    await expect(menu).toBeVisible();
  });

  test("moving the mouse outside the trigger and menu union closes the menu", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: "Actions" });
    const menu = page.getByRole("menu", { name: "Actions" });
    await trigger.hover();
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.mouse.move(4, 4);
    await expect(menu).toBeHidden();
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
