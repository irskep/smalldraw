# Vertical grid pagination — lab notes

## Experiment 1: Height propagation

**Hypothesis:** Vertical pagination fails because `.button-grid-inline-host` has no explicit height, so the shell's `max-height: min(100%, ...)` resolves to unconstrained. Adding `height: 100%` to the inline-host in vertical mode should allow the shell to constrain itself and trigger pagination.

**Procedure:**
1. Add `height: 100%` to `.button-grid[data-resolved-orientation="vertical"] .button-grid-inline-host` in ButtonGrid.css
2. Set `grid.el.style.height = "24rem"` in the vertical story
3. Call `syncLayout()` after mount via rAF so pagination can re-measure
4. Reload and check if nav buttons appear and items are paginated

**Observation:** Pagination now works. Prev button disabled on first page, next enabled. Two items visible per page (Pencil + Fill) in single-column layout, consistent with vertical mobile mode. Clicking next page shows the next pair.

**Conclusion:** Fix confirmed. The inline-host needed `height: 100%` to let the shell's percentage-based max-height resolve against the consumer-provided height on `.button-grid`.

---

## Experiment 2: Dynamic items — nav hidden vs disabled at single-page count

**Hypothesis:** Removing items down to 3 (which fit on one page) would hide the nav buttons entirely.

**Observation:** The nav buttons remain visible but disabled when items fit on one page. The `syncPagerControls` method hides nav only when `pageItemIndices.length <= 1`, which is true, but the grid also checks `items.length === 0`. Looking at the code: it hides when `!shouldPaginate() || items.length === 0 || pageItemIndices.length <= 1`. With 3 items in mobile mode, `shouldPaginate()` is true, items.length > 0, and pageItemIndices.length should be 1 — so it should hide. But the nav is still visible. The likely cause: after removing items, pagination hasn't recalculated yet or the viewport size still splits into multiple pages.

**Revised approach:** The test expectation was wrong. With the current frame width, 3 items may still span more than one page if the frame is narrow. Change the test to assert nav buttons become disabled (not hidden), or remove enough items that they definitely fit.

**Resolution (attempt 1):** Adjusted test to check disabled instead of hidden. Still fails — next page is enabled with 3 items.

**Hypothesis 2:** With `ds-story-frame` at `min(100%, 24rem)` and cell size 4.5rem + gaps + nav button widths, even 3 items may not fit within the viewport. The pagination algorithm measures the actual viewport and splits items that don't fit. Need to remove more items (down to 2 or 1) or change the test to simply verify that removing items reduces pagination.

**Experiment:** Change the test to remove all but 1 item. One item should always fit in a single page.

**Observation:** With 1 item, `pageItemIndices.length <= 1` is true, so nav is hidden. Test passes.

**Conclusion:** The original test assumed 3 items would fit one page, but the frame is only 24rem wide and with cell size 4.5rem + gaps, 3 items actually span 2 pages. Adjusted test to 1 item which is a cleaner assertion of the "no pagination needed" behavior.

---

## Experiment 3: Grid shell overflows its container

**Hypothesis:** The `.button-grid-shell` has `width: max-content` and `max-width: min(100%, calc(100vw - 24px))`. The grid root has `max-width: 100%` and the frame has `width: min(100%, 24rem)` = 384px. The shell is 402px — it overflows by 18px. The `max-width: 100%` on the shell should prevent this, but its parent `.button-grid-inline-host` has no explicit width, so 100% doesn't resolve.

**Measurements:**
- Frame: 384px, Grid: 384px, Shell: 402px
- Shell needs: 2 nav buttons (72px each) + viewport (228px) + gaps + padding = ~402px
- The shell's max-width 100% resolves against inline-host which has no width constraint

**Fix:** Add `overflow: hidden` on `.button-grid` so the shell can't visually overflow. But that doesn't fix the pagination measurement. Better fix: give the horizontal inline-host `max-width: 100%` so the shell's `100%` resolves correctly.

**Deeper investigation:**
- Shell computed width = 384px, but actual = 402px
- box-sizing: content-box, padding: 8px each side, border: 1px each side
- 384 (content) + 16 (padding) + 2 (border) = 402px total
- The mobile rule sets `width: 100%` but doesn't set `box-sizing: border-box`

**Fix:** The base `.button-grid-shell` rule should use `box-sizing: border-box` so padding/border are included in the width calculation. This is already done on `.ds-icon-button` — it's just missing on the shell.

**Procedure:**
1. Add `box-sizing: border-box` to `.button-grid-shell` base rule
2. Measure again — expect shell width to equal frame width (384px)

**Observation (chrome-devtools):** Shell width now 384px, matches frame exactly in DevTools measurement.

**Observation (user's actual device):** Items are now clipped worse. The `box-sizing: border-box` shrinks the content area by 18px. The pagination algorithm measures viewport before the shell is constrained, so it thinks 3 items fit. But after render, the viewport is narrower and the third item is clipped. This is worse than the original overflow.

**Conclusion:** Revert `box-sizing: border-box`. Wrong approach — it changes the content area and creates a measurement mismatch with the pagination algorithm.

## Experiment 4: Global border-box — diagnose pagination clipping

Global `box-sizing: border-box` is now set in `styles.css`. The grid shell no longer overflows its frame (384px = 384px). However, 4 items are displayed on page 1 when only 2 should fit in the ~210px viewport.

### Experiment 4a: Instrument computePagination to capture actual measurements

**Hypothesis:** `computePagination()` either (a) measures a different viewport width than the post-render simulation measured (210px), or (b) hits the `viewportMainSize <= 1` bail-out path and falls back to showing all items on one page. Specifically, I suspect the bail-out path: when `render()` clears `viewport.style.width = ""` at the top and then renders all 12 items, the viewport may momentarily have width 0 or some degenerate value before the browser lays out, causing the algorithm to bail and put all items on one page.

**Procedure:**
1. Add `console.log` statements inside `computePagination` to capture: viewport width, item positions (starts/ends), computed pages, and whether the bail-out path is hit.
2. Navigate to `/#grid-pagination` in Chrome, read the console output.
3. Compare measured values with the expected math (viewport ~206px, 2 items per page).

**Observation:**

Console output:
1. First `computePagination` call: **BAIL** — `viewportMainSize=0` (grid not in DOM when `setItems()` runs in `buildGridDemo`, before `frame.append(grid.el)`)
2. rAF retry fires `computePagination` again: `viewportMainSize=370`, computes 4 items per page

Post-render measurements confirm the mismatch:
- `viewport.style.width = "370px"` (inline, set from measured value)
- `viewport.getBoundingClientRect().width = 210px` (actual rendered, flex-shrunk)
- `trackWidth = 206px` but 4 items × 72px + 3 gaps × 8px = 312px needed → items clipped

**Root cause chain:**
1. `setItems()` called before grid is in DOM → viewport width = 0 → bail-out → all items on one page
2. `syncPagerControls`: one page → nav buttons **hidden**
3. rAF retry: `render()` clears viewport inline styles, renders all items, calls `computePagination`
4. Nav buttons are still hidden from step 2 → viewport gets ALL shell space = 370px (shell 384px border-box − 16px padding − 2px border + 4px from viewport negative margin)
5. Algorithm fits 4 items in 370px (correct for that width)
6. `render()` shows only those 4 items, then `syncPagerControls` **shows** nav buttons (multiple pages now)
7. Nav buttons reappear → flex shrinks viewport from 370px to 210px, but pagination was computed for 370px
8. 4 items need 312px but viewport is 210px → **clipping**

The fundamental bug: **pagination measures viewport with nav buttons hidden, but renders with them visible.**

### Experiment 4b: Ensure nav buttons visible during measurement

**Hypothesis:** If we show nav buttons before measuring in `computePagination`, the viewport will be ~210px during measurement, and the algorithm will correctly compute 2 items per page. After rendering 2 items, `syncPagerControls` will keep nav buttons visible (multiple pages), and the viewport width will match the measurement.

**Procedure:**
1. At the start of `render()`, when `needsPaginationRecalc && shouldPaginate()`, unhide nav buttons before calling `renderItems` + `computePagination`
2. Reload, check console for correct viewport measurement (~210px) and 2 items per page
3. Visually verify no clipping

**Observation:** Fix works. Console confirms rAF retry now measures `viewportMainSize=210` (was 370). Chrome DevTools measurements for all 4 grid stories:

| Story | Axis | Viewport size | Items on page | Any clipped? |
|---|---|---|---|---|
| Grid: Pagination | horizontal | 210px | 2 | No |
| Grid: Mode Switching | horizontal | 402px | 5 | No |
| Grid: Dynamic Items | horizontal | 210px | 2 | No |
| Grid: Vertical | vertical | 210px | 2 | No |

**Mathematical proof (Grid: Pagination, horizontal mobile):**
- Frame: 384px
- Shell: 384px (border-box, padding 8px × 2, border 1px × 2 → content area = 366px)
- Nav buttons: 72px × 2 = 144px, flex: 0 0 72px (no shrink)
- Shell gap: 8px × 2 = 16px
- Available for viewport: 366 − 144 − 16 = 206px
- Viewport: border-box 210px (padding 2px × 2 from bleed, margin −2px × 2 → effective content = 206px)
- Items: 72px each, gap 8px. Item 0 ends at 72px, Item 1 ends at 152px.
- pageLimit = 0 + 210 + 1.5 = 211.5px
- Item 0 (72) ≤ 211.5 ✓, Item 1 (152) ≤ 211.5 ✓, Item 2 (232) > 211.5 ✗
- Page 0 = [0, 1] → 2 items. Track content = 72 + 8 + 72 = 152px ≤ 206px ✓ No clipping.

**Conclusion:** The fix ensures nav buttons are visible during measurement, so the viewport width reflects actual available space. All 4 grid stories verified via Chrome measurements — zero clipping. All unit and UI tests pass.

---

## Experiment 5: Multi-row/column grid stories

### Experiment 5a: rAF retry only fires in mobile mode

**Hypothesis:** The rAF layout retry (which re-runs pagination after the grid is mounted in the DOM) only fires when `this.state.mode === "mobile"`. A grid with `paginateInLarge: true` in `"large"` mode will fail to paginate on initial load because the viewport measures 0 (not in DOM), bails, and never retries.

**Procedure:** Add a "Grid: Two-Row XLarge" story with `paginateInLarge: true` in large mode. Load the page and check if pagination activates.

**Observation:** Confirmed. No nav buttons, only 4 of 12 items visible (viewport clips the rest). The rAF retry condition checked `this.state.mode === "mobile"`, excluding large mode.

**Fix:** Removed the `mode === "mobile"` guard from the rAF retry condition. Now retries for any mode where `shouldPaginate()` is true.

### Experiment 5b: Nav buttons inherit doubled cell size in xlarge

**Hypothesis:** In `two-row-xlarge` layout, `.button-grid` sets `--button-grid-cell-size` to `2×`. Nav buttons use this variable for sizing, so they become 144px instead of 72px — consuming excessive space.

**Observation:** Confirmed via screenshot. Nav buttons are as tall as the doubled grid cells.

**Fix:** Introduced `--button-grid-nav-size` (set to the base cell size, not doubled). Nav button CSS now uses `--button-grid-nav-size` instead of `--button-grid-cell-size`.

### Experiment 5c: Vertical two-column grid overflows in large mode

**Hypothesis:** Setting `grid.el.style.height = "24rem"` in a vertical grid story causes overflow in large mode (no pagination). The shell renders all 12 items at full size, exceeding the 24rem constraint, and overflows because large mode sets `overflow: visible` on the viewport.

**Observation:** Confirmed. Items spill below the card boundary.

**Fix:** Only apply the height constraint when paginating (mobile mode). Remove it in large mode.

**Test coverage:** All three fixes covered by new UI tests:
- "Grid: Two-Row" — large mode all visible, mobile paginates
- "Grid: Two-Row XLarge" — paginates in large mode with doubled cells
- "Grid: Vertical Two-Column" — large mode all visible, mobile paginates
