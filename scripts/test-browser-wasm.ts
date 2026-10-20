/** Exercise the actual Vite/Bun production output against an isolated server. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect, webkit } from "@playwright/test";
import * as opaque from "@serenity-kit/opaque";
import { decode } from "@automerge/automerge-repo/helpers/cbor.js";
import { checkGuestSharing } from "./check-guest-sharing";

await opaque.ready;

const root = path.resolve(import.meta.dir, "..");
const temporary = await mkdtemp(path.join(tmpdir(), "smalldraw-wasm-"));
const apiPort = 43126;
const port = 43125;
const origin = `http://localhost:${port}`;
const env = {
  ...process.env,
  NODE_ENV: "test",
  R2_ACCOUNT_ID: "",
  R2_BUCKET: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  R2_PUBLIC_BASE_URL: "",
  PORT: String(apiPort),
  DATABASE_URL: path.join(temporary, "app.db"),
  AUTOMERGE_DB_PATH: path.join(temporary, "automerge.db"),
  FRONTEND_ORIGINS: origin,
  OPAQUE_SERVER_SETUP: opaque.server.createSetup(),
};
async function run(command: string[], extraEnv = {}) {
  const process = Bun.spawn(command, {
    cwd: root,
    env: { ...env, ...extraEnv },
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await process.exited) !== 0)
    throw new Error(`Failed: ${command.join(" ")}`);
}
let backend: ReturnType<typeof Bun.spawn> | undefined;
let preview: ReturnType<typeof Bun.serve> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
async function checkCaptureLoss(
  page: import("@playwright/test").Page,
  browserName: string,
) {
  const check = await page.context().browser()!.newPage();
  try {
    await check.goto(`${origin}/draw/?new=1`);
    await check.waitForURL(/local=/);
    const paper = check.locator(".kids-draw-frame");
    await expect(paper).toBeVisible();
    const count = () =>
      check.evaluate(
        () =>
          Object.keys((window as any).kidsDrawApp.store.getDocument().shapes)
            .length,
      );
    let expected = 0;
    for (const tool of ["brush.marker", "brush.freehand"]) {
      await check.locator(`[data-tool-variant="${tool}"]:visible`).click();
      for (const loseCapture of [true, false]) {
        const box = (await paper.boundingBox())!;
        await check.evaluate(() => {
          document.addEventListener(
            "pointerdown",
            (event) => {
              (window as any).__captureTest = {
                element: event.target,
                id: event.pointerId,
              };
            },
            { once: true },
          );
        });
        await check.mouse.move(box.x + 40, box.y + 40 + expected * 30);
        await check.mouse.down();
        await check.mouse.move(box.x + 180, box.y + 50 + expected * 30, {
          steps: 8,
        });
        if (loseCapture) {
          await check.evaluate(() => {
            const { element, id } = (window as any).__captureTest;
            element.releasePointerCapture(id);
          });
          // The browser processes pending capture changes on the next pointer event.
          await check.mouse.move(box.x + 185, box.y + 50 + expected * 30);
          await expect.poll(count).toBe(expected + 1);
        }
        await check.mouse.up();
        expected++;
        await expect.poll(count).toBe(expected);
      }
    }
    await paper.screenshot({ path: `/tmp/capture-loss-${browserName}.png` });
    await check.waitForTimeout(500);
    await check.reload();
    await check.waitForFunction(() => Boolean((window as any).kidsDrawApp));
    await expect.poll(count).toBe(expected);
    await expect(paper).toBeVisible();
    await paper.screenshot({
      path: `/tmp/capture-loss-${browserName}-reload.png`,
    });
    console.log(
      `PASS: ${browserName} capture loss preserves pen/marker strokes once, next strokes work, and all survive reload`,
    );
  } finally {
    await check.close();
  }
}

async function checkRandomize(
  page: import("@playwright/test").Page,
  browserName: string,
) {
  const state = () =>
    page.evaluate(() => {
      const store = (window as any).kidsDrawApp.store;
      return {
        id: store.getActiveToolId(),
        color: store.getSharedSettings().strokeColor,
        size: store.getSharedSettings().strokeWidth,
        shapes: JSON.stringify(store.getDocument().shapes),
      };
    });
  for (const [family, fields] of [
    ["brush", ["id", "color", "size"]],
    ["fill", ["color"]],
    ["shape.filled", ["id", "color"]],
    ["shape.outline", ["id", "color", "size"]],
    ["stamp.images", ["id", "size"]],
    ["stamp.alphabet", ["id", "color", "size"]],
  ] as const) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .locator(`[data-tool-family="${family}"]:visible`)
      .first()
      .click();
    const randomize = page.getByRole("button", {
      name: "Randomize",
      exact: true,
    });
    for (const width of [1280, 580, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(randomize).toBeInViewport();
      await page.waitForTimeout(200);
      const canvasBefore = await page.locator(".kids-draw-frame").boundingBox();
      const before = await state();
      await randomize.click();
      await expect
        .poll(async () => {
          const after = await state();
          return fields.every((field) => after[field] !== before[field]);
        })
        .toBe(true);
      const after = await state();
      expect(after.shapes).toBe(before.shapes);
      for (const field of ["id", "color", "size"] as const) {
        if (!(fields as readonly string[]).includes(field))
          expect(after[field]).toBe(before[field]);
      }
      await page.waitForTimeout(300);
      expect(await page.locator(".kids-draw-frame").boundingBox()).toEqual(
        canvasBefore,
      );
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `/tmp/randomize-${browserName}-${family}-${width}.png`,
      });
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .locator('[data-tool-family="stamp.images"]:visible')
    .first()
    .click();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.evaluate(() =>
    (window as any).kidsDrawApp.store.activateTool("stamp.image.motorcycle"),
  );
  await expect(page.locator(".ds-splat-context__active-tool")).toHaveText(
    "Stamp: Motorcycle",
  );
  const toolLabel = page.locator(".ds-splat-context__active-tool-name");
  await expect
    .poll(() => toolLabel.evaluate((e) => e.getBoundingClientRect().height))
    .toBeLessThanOrEqual(44);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('[data-tool-family="eraser"]:visible').first().click();
  await expect(
    page.getByRole("button", { name: "Randomize", exact: true }),
  ).toBeHidden();
  await page.locator('[data-tool-family="brush"]:visible').first().click();
  console.log(
    `PASS: ${browserName} randomize changes only opted-in settings without editing drawings or shifting the canvas`,
  );
}

async function checkOtherToolPreviews(
  page: import("@playwright/test").Page,
  browserName: string,
) {
  const preview = page.locator(".ds-tool-state-preview");
  for (const family of [
    "brush",
    "eraser",
    "fill",
    "shape.filled",
    "shape.outline",
  ]) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .locator(`[data-tool-family="${family}"]:visible`)
      .first()
      .click();
    await expect(preview.locator("svg")).toBeVisible();
    if (
      family === "brush" ||
      family === "eraser" ||
      family === "shape.outline"
    ) {
      await page.getByRole("button", { name: "Strokes", exact: true }).click();
      await page.locator('[data-size="2"]').click();
      const small = await preview.locator("svg").innerHTML();
      await page.getByRole("button", { name: "Strokes", exact: true }).click();
      await page.locator('[data-size="200"]').click();
      await expect
        .poll(() => preview.locator("svg").innerHTML())
        .not.toBe(small);
    }
    if (family !== "eraser") {
      await page.getByRole("button", { name: "Colors", exact: true }).click();
      await page
        .locator('[data-setting="stroke-color"][data-color="#2e86ff"]')
        .click();
      await expect(preview).toHaveCSS("color", "rgb(46, 134, 255)");
    }
    await page.screenshot({
      path: `/tmp/tool-preview-${browserName}-${family}.png`,
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(preview).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `/tmp/tool-preview-${browserName}-${family}-mobile.png`,
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('[data-tool-family="brush"]:visible').first().click();
  for (const id of [
    "brush.freehand",
    "brush.even-spraycan",
    "brush.uneven-spraycan",
    "brush.marker",
  ]) {
    await page.locator(`[data-tool-variant="${id}"]:visible`).click();
    await expect(preview.locator("svg")).toBeVisible();
    await page.screenshot({
      path: `/tmp/tool-preview-${browserName}-${id}.png`,
    });
  }
  console.log(
    `PASS: ${browserName} brush, eraser, fill, and shape previews respond to color/size and fit mobile`,
  );
}

async function checkPreviewDoesNotMoveCanvas(
  page: import("@playwright/test").Page,
  browserName: string,
) {
  for (const width of [580, 900, 1280, 1920]) {
    await page.setViewportSize({ width, height: 850 });
    await page.locator('[data-tool-family="brush"]:visible').first().click();
    await page.waitForTimeout(250);
    const canvas = page.locator(".kids-draw-frame");
    const rail = page.locator(".ds-splat-context__slot--left");
    const canvasBefore = await canvas.boundingBox();
    const railBefore = await rail.boundingBox();
    for (const family of [
      "stamp.images",
      "stamp.alphabet",
      "brush",
      "stamp.alphabet",
    ]) {
      await page
        .locator(`[data-tool-family="${family}"]:visible`)
        .first()
        .click();
      await page.waitForTimeout(250);
      expect(
        await rail.boundingBox(),
        `${browserName} ${width} ${family} rail`,
      ).toEqual(railBefore);
      expect(
        await canvas.boundingBox(),
        `${browserName} ${width} ${family} canvas`,
      ).toEqual(canvasBefore);
    }
    await page.screenshot({
      path: `/tmp/stable-preview-${browserName}-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('[data-tool-family="brush"]:visible').first().click();
  console.log(
    `PASS: ${browserName} canvas and rail stay fixed across stamp, letter, and brush switches`,
  );
}

try {
  await run(["mise", "run", "//apps/app:build"], {
    NODE_ENV: "production",
    VITE_API_URL: `${origin}/api/v1`,
    VITE_BASE: "/",
  });
  await run(["mise", "run", "--force", "//apps/splat-web:build"], {
    NODE_ENV: "production",
    SPLATTERBOARD_PUBLIC_SYNC_SERVER_HTTP_URL: `${origin}/api/v1`,
    SPLATTERBOARD_PUBLIC_SYNC_SERVER_WEBSOCKET_URL: `ws://localhost:${apiPort}`,
    SPLATTERBOARD_PUBLIC_JOIN_BASE_URL: `${origin}/draw/`,
    SPLATTERBOARD_PUBLIC_ASSET_BASE_URL: `${origin}/draw`,
  });
  await run(["bunx", "drizzle-kit", "push", "--force"]);
  backend = Bun.spawn(["bun", "apps/server/src/index.ts"], {
    cwd: root,
    env,
    stdout: Bun.file(path.join(temporary, "server.log")),
    stderr: "inherit",
  });
  preview = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        url.port = String(apiPort);
        return fetch(new Request(url, request));
      }
      const drawing = url.pathname.startsWith("/draw/");
      const directory = path.join(
        root,
        drawing ? "apps/splat-web/dist" : "apps/app/dist",
      );
      const name = drawing ? url.pathname.slice(6) : url.pathname.slice(1);
      const file = Bun.file(path.join(directory, name || "index.html"));
      if (await file.exists()) return new Response(file);
      if (path.extname(name)) return new Response("Not found", { status: 404 });
      return new Response(Bun.file(path.join(directory, "index.html")));
    },
  });
  await expect
    .poll(async () => {
      try {
        return (await fetch(`http://localhost:${apiPort}/healthz`)).status;
      } catch {
        return 0;
      }
    })
    .toBe(200);
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let wasmRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith(".wasm")) wasmRequests++;
  });
  await page.goto(origin);
  await expect(
    page.getByRole("heading", { name: "A free drawing app for kids" }),
  ).toBeVisible();
  expect(wasmRequests).toBe(0);
  console.log("PASS: guest landing page makes no WASM request");

  async function editorReady() {
    await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
  }
  async function stroke() {
    const canvas = page.locator(".kids-draw-frame");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Missing drawing canvas");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 60,
      box.y + box.height / 2 + 30,
      { steps: 8 },
    );
    await page.mouse.up();
  }
  const shapeCount = () =>
    page.evaluate(
      () =>
        Object.keys((window as any).kidsDrawApp.store.getDocument().shapes)
          .length,
    );
  await page.goto(`${origin}/draw/?new=1`);
  await editorReady();
  expect(wasmRequests).toBe(1);
  await stroke();
  await expect.poll(shapeCount).toBe(1);
  const drawingUrl = page.url();
  await page.waitForTimeout(500);
  await page.reload();
  await editorReady();
  await expect.poll(shapeCount).toBe(1);
  await context.setOffline(true);
  await stroke();
  await expect.poll(shapeCount).toBe(2);
  await page.waitForTimeout(500);
  await context.setOffline(false);
  // API outages must not prevent a locally saved drawing from opening/editing.
  await page.route("**/api/**", (route) => route.abort());
  await page.reload();
  await editorReady();
  await expect.poll(shapeCount).toBe(2);
  await stroke();
  await expect.poll(shapeCount).toBe(3);
  await page.unroute("**/api/**");
  await page.waitForTimeout(500);
  console.log(
    "PASS: binary WASM initializes; drawing survives reload and API outage",
  );

  const activeTool = page.locator(".ds-splat-context__active-tool");
  await expect(activeTool).toHaveText("Marker");
  await page.locator('[data-tool-family="eraser"]:visible').first().click();
  await expect(activeTool).toHaveText("Eraser");
  await expect(activeTool.locator("svg")).toBeVisible();
  await page.locator('[data-tool-family="fill"]:visible').first().click();
  await expect(activeTool).toHaveText("Fill");
  await page.locator('[data-tool-family="brush"]:visible').first().click();
  await page
    .locator('[data-tool-variant][title="Spray (Hold)"]:visible')
    .click();
  await expect(activeTool).toHaveText("Spray (Hold)");
  for (const [width, height] of [
    [1280, 800],
    [580, 580],
    [390, 664],
    [320, 568],
    [844, 320],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(activeTool).toHaveText("Spray (Hold)");
    await expect(activeTool).toBeInViewport();
    await expect
      .poll(async () => {
        const label = await activeTool.boundingBox();
        const menu = await page
          .getByRole("button", { name: "Menu", exact: true })
          .boundingBox();
        return Boolean(
          label &&
            menu &&
            (label.x + label.width <= menu.x ||
              label.y + label.height <= menu.y) &&
            menu.x + menu.width <= width,
        );
      })
      .toBe(true);
    await expect
      .poll(() =>
        activeTool.evaluate(
          (e) =>
            e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
        ),
      )
      .toBe(true);
    await page.screenshot({ path: `/tmp/smalldraw-tool-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .locator('[data-tool-family="stamp.images"]:visible')
    .first()
    .click();
  await expect(activeTool).toHaveText("Stamp: Bird 1");
  const toolPreview = page.locator(".ds-tool-state-preview");
  await expect(toolPreview).toHaveAttribute("aria-label", "Stamp: Bird 1");
  await expect(toolPreview.locator("img")).toBeVisible();
  const stampSource = await toolPreview.locator("img").getAttribute("src");
  for (const [width, height] of [
    [1280, 800],
    [900, 800],
    [580, 800],
    [390, 664],
    [320, 568],
    [844, 320],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(toolPreview).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        toolPreview
          .locator("img")
          .evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.screenshot({ path: `/tmp/stamp-preview-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  const stampGrid = page.locator(".ds-splat-context__variant-strip:visible");
  await stampGrid
    .getByRole("button", { name: "Next page", exact: true })
    .click();
  await expect(toolPreview.locator("img")).toHaveAttribute("src", stampSource!);
  await page.waitForTimeout(900);
  const nextStamp = stampGrid.locator("[data-tool-variant]:visible").first();
  const nextStampName = await nextStamp.getAttribute("title");
  await nextStamp.click();
  await expect(toolPreview).toHaveAttribute(
    "aria-label",
    `Stamp: ${nextStampName}`,
  );
  await stampGrid
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await page.waitForTimeout(900);
  await page.locator('[data-tool-variant="stamp.image.bird1"]:visible').click();

  await expect(activeTool.locator("img")).toHaveCount(0);
  await expect(activeTool.locator("svg")).toBeVisible();
  expect(await activeTool.locator("svg").innerHTML()).toBe(
    await page
      .locator('[data-tool-family="stamp.images"]:visible svg')
      .first()
      .innerHTML(),
  );
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(activeTool).toBeInViewport();
  await expect
    .poll(() =>
      activeTool.evaluate(
        (e) =>
          e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
      ),
    )
    .toBe(true);
  await page.screenshot({ path: "/tmp/smalldraw-tool-stamp-320.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .locator('[data-tool-family="stamp.alphabet"]:visible')
    .first()
    .click();
  await expect(activeTool).toHaveText("Letter: A");
  await expect(toolPreview).toHaveAttribute("aria-label", "Letter: A");
  await expect(toolPreview.locator("svg")).toBeVisible();
  await expect(toolPreview.locator("img")).toHaveCount(0);
  await page.getByRole("button", { name: "Colors", exact: true }).click();
  const colorSwatch = page.locator('[data-setting="stroke-color"]').nth(3);
  const letterColor = await colorSwatch.getAttribute("data-color");
  await colorSwatch.click();
  await expect
    .poll(() => toolPreview.evaluate((e) => e.style.color))
    .toBe(
      await page.evaluate((color) => {
        const e = document.createElement("span");
        e.style.color = color!;
        return e.style.color;
      }, letterColor),
    );
  await page.locator('[data-tool-variant="stamp.letter.b"]:visible').click();
  await expect(toolPreview).toHaveAttribute("aria-label", "Letter: B");
  await page.screenshot({ path: "/tmp/letter-preview.png" });
  console.log(
    "PASS: stamp preview stays visible across layouts and paging; letter preview follows selection and color",
  );
  await page
    .locator('[data-tool-family="shape.filled"]:visible')
    .first()
    .click();
  await expect(activeTool).toHaveText("Filled rectangle");
  await expect(toolPreview).toBeVisible();
  await expect(toolPreview).toHaveAttribute("aria-label", /Filled rectangle/);
  await page
    .locator('[data-tool-family="shape.outline"]:visible')
    .first()
    .click();
  await expect(activeTool).toHaveText("Rectangle outline");
  await page.locator('[data-tool-family="brush"]:visible').first().click();
  await page.locator('[data-tool-variant][title="Marker"]:visible').click();
  await expect(activeTool).toHaveText("Marker");
  console.log(
    "PASS: active tool label follows selection and stays visible across layouts",
  );

  // WebKit's non-persistent context reproduces Safari Private Browsing storage.
  const safari = await webkit.launch();
  try {
    await checkGuestSharing(safari, origin);
    const privatePage = await safari.newPage({
      viewport: { width: 1280, height: 800 },
    });
    const thumbnailWarnings: string[] = [];
    privatePage.on("console", (message) => {
      if (message.text().includes("failed to save thumbnail"))
        thumbnailWarnings.push(message.text());
    });
    await privatePage.goto(`${origin}/draw/?new=1`);
    const paper = privatePage.locator(".kids-draw-frame");
    await expect(paper).toBeVisible();
    await privatePage.waitForURL(/local=/);
    await paper.hover({ position: { x: 50, y: 50 } });
    const box = (await paper.boundingBox())!;
    await privatePage.mouse.down();
    await privatePage.mouse.move(box.x + 150, box.y + 150, { steps: 8 });
    await privatePage.mouse.up();
    await privatePage
      .locator('[data-tool-family="stamp.images"]:visible')
      .first()
      .click();
    const safariPreview = privatePage.locator(".ds-tool-state-preview");
    for (const width of [1280, 580, 320]) {
      await privatePage.setViewportSize({ width, height: 800 });
      await expect(safariPreview).toBeInViewport();
      await expect(safariPreview).toHaveAttribute(
        "aria-label",
        "Stamp: Bird 1",
      );
      await expect
        .poll(() =>
          privatePage.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      await privatePage.screenshot({
        path: `/tmp/stamp-preview-webkit-${width}.png`,
      });
    }
    await privatePage.setViewportSize({ width: 1280, height: 800 });
    for (const reload of [false, true]) {
      if (reload) {
        await privatePage.reload();
        await expect(paper).toBeVisible();
      }
      await privatePage
        .getByRole("button", { name: "Menu", exact: true })
        .click();
      await privatePage
        .getByRole("menuitem", { name: "Your drawings", exact: true })
        .click();
      const thumbnail = privatePage
        .locator(".kids-draw-document-browser-dialog__thumbnail-media img")
        .first();
      await expect(thumbnail).toBeVisible();
      await expect
        .poll(() =>
          thumbnail.evaluate((element) => {
            const img = element as HTMLImageElement;
            if (!img.complete || !img.naturalWidth) return false;
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            const pixels = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            ).data;
            for (let i = 0; i < pixels.length; i += 4) {
              if (
                pixels[i + 3] > 0 &&
                pixels[i] < 100 &&
                pixels[i + 1] < 100 &&
                pixels[i + 2] < 100
              )
                return true;
            }
            return false;
          }),
        )
        .toBe(true);
    }
    await privatePage
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await checkPreviewDoesNotMoveCanvas(privatePage, "webkit");
    await checkOtherToolPreviews(privatePage, "webkit");
    await checkRandomize(privatePage, "webkit");
    await checkCaptureLoss(privatePage, "webkit");
    expect(thumbnailWarnings).toEqual([]);
    console.log(
      "PASS: private WebKit saves a nonblank thumbnail and restores it after reload",
    );
  } finally {
    await safari.close();
  }

  await checkPreviewDoesNotMoveCanvas(page, "chromium");
  await checkOtherToolPreviews(page, "chromium");
  await checkRandomize(page, "chromium");
  await checkCaptureLoss(page, "chromium");

  // Check shipped CSS, whose bundling order differs from the dev server.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Your drawings", exact: true })
    .click();
  const dialog = page.locator(".kids-draw-document-browser-dialog");
  const grid = dialog.locator(".kids-draw-document-browser-dialog__grid");
  const scroller = dialog.locator(".ds-dialog-scaffold__body");
  await expect(dialog).toBeVisible();
  for (const [width, height] of [
    [1280, 800],
    [1920, 1080],
    [390, 664],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() => dialog.evaluate((e) => e.getBoundingClientRect().width))
      .toBeGreaterThan(
        width > 720 ? Math.min(width * 0.85, 1100) : width * 0.85,
      );
    await expect
      .poll(() =>
        grid.evaluate(
          (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
        ),
      )
      .toBeGreaterThanOrEqual(2);
    const box = await dialog.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    expect(await scroller.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/smalldraw-browser-${width}.png` });
  }
  // Fill the grid with representative cards to exercise overflow without changing saved drawings.
  await grid.evaluate((e) => {
    const tiles = e.querySelector(".kids-draw-document-browser-dialog__tiles")!;
    const card = tiles.firstElementChild!;
    for (let i = 0; i < 20; i++) tiles.append(card.cloneNode(true));
  });
  for (const [width, height] of [
    [1280, 800],
    [390, 664],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await scroller.hover();
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => scroller.evaluate((e) => e.scrollTop))
      .toBeGreaterThan(0);
    await scroller.evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true }),
    ).toBeInViewport();
    await expect(
      dialog.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: `/tmp/smalldraw-browser-full-${width}.png` });
    await scroller.evaluate((e) => {
      e.scrollTop = 0;
    });
  }
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  console.log(
    "PASS: production drawing browser desktop/mobile grid, bounds, and scrolling",
  );

  await page.bringToFront();
  const incrementalCheckpoints: number[] = [];
  let checkpointReplies = 0;
  page.on("response", async (response) => {
    if (!response.url().includes("/checkpointAccountDrawing") || !response.ok())
      return;
    const body = response.request().postDataBuffer();
    if (!body) return;
    const request = decode(body) as {
      baseHeads: string[] | null;
      content: Uint8Array;
    };
    const result = decode(new Uint8Array(await response.body())) as {
      result: { status: string };
    };
    if (result.result.status === "saved") {
      checkpointReplies++;
      console.log("Checkpoint acknowledgement", {
        incremental: request.baseHeads !== null,
        bytes: request.content.length,
      });
    }
    if (request.baseHeads !== null && result.result.status === "saved")
      incrementalCheckpoints.push(request.content.length);
  });
  await page.goto(`${origin}/register`);
  await page.getByPlaceholder("Username").fill("wasm-browser-test");
  await page.getByPlaceholder("Password").fill("Wasm-browser-test-password!");
  await page
    .getByRole("checkbox", { name: "I am at least 16 years old" })
    .check();
  await page.locator('form.portal-form button[type="submit"]').click();
  await page.waitForURL(origin + "/");
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("drawing-workspace") ?? "null"),
      ),
    )
    .not.toBeNull();
  await expect(
    page.getByRole("heading", { name: "Your drawings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByText("Log out", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A free drawing app for kids" }),
  ).toBeVisible();
  console.log(
    "PASS: signup imports guest drawing; account checkpoints before sign-out",
  );
  await page.goto(`${origin}/login`);
  await page.getByPlaceholder("Username").fill("wasm-browser-test");
  await page.getByPlaceholder("Password").fill("Wasm-browser-test-password!");
  await page.locator('form.portal-form button[type="submit"]').click();
  await page.waitForURL(origin + "/");
  await expect(
    page.getByRole("heading", { name: "Your drawings" }),
  ).toBeVisible();
  const repliesBeforeOpen = checkpointReplies;
  await page.goto(
    drawingUrl.replace(
      /local=[^&]+/,
      (match) =>
        `doc=${decodeURIComponent(match.slice(6)).replace("automerge:", "")}`,
    ),
  );
  await editorReady();
  await expect.poll(shapeCount).toBe(3);
  expect(errors).toEqual([]);
  console.log(
    "PASS: fresh login restores all three strokes from server using binary WASM",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("drawing-sync-retry")),
  );
  await expect
    .poll(() => checkpointReplies, { timeout: 20_000 })
    .toBeGreaterThan(repliesBeforeOpen);
  await stroke();
  await expect.poll(shapeCount).toBe(4);
  await expect
    .poll(() => incrementalCheckpoints.length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  const checkpointCount = incrementalCheckpoints.length;
  await stroke();
  await expect.poll(shapeCount).toBe(5);
  await expect
    .poll(() => incrementalCheckpoints.length, { timeout: 20_000 })
    .toBeGreaterThan(checkpointCount);
  const fullRepliesBeforeReload =
    checkpointReplies - incrementalCheckpoints.length;
  const incrementalBeforeReload = incrementalCheckpoints.length;
  await page.reload();
  await editorReady();
  await expect.poll(shapeCount).toBe(5);
  await stroke();
  await expect.poll(shapeCount).toBe(6);
  await expect
    .poll(() => incrementalCheckpoints.length, { timeout: 20_000 })
    .toBeGreaterThan(incrementalBeforeReload);
  expect(checkpointReplies - incrementalCheckpoints.length).toBe(
    fullRepliesBeforeReload,
  );
  console.log(
    "PASS: checkpoint progress survives reload; next edit uploads only changes",
  );
  const coldContext = await browser.newContext({
    storageState: await context.storageState(),
  });
  const coldPage = await coldContext.newPage();
  await coldPage.goto(page.url());
  await expect
    .poll(
      () =>
        coldPage.evaluate(() => {
          const app = (window as any).kidsDrawApp;
          return app ? Object.keys(app.store.getDocument().shapes).length : -1;
        }),
      { timeout: 20_000 },
    )
    .toBe(6);
  await coldContext.close();
  console.log(
    "PASS: incremental account checkpoints restore all edits in a fresh browser",
    incrementalCheckpoints,
  );

  await page
    .locator('[data-tool-family="stamp.images"]:visible')
    .first()
    .click();
  await expect(activeTool).toHaveText("Stamp: Bird 1");
  for (const width of [1280, 900, 899, 600, 580]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(
      page.locator(".ds-splat-context__sync-indicator"),
    ).toBeVisible();
    await expect
      .poll(() => activeTool.evaluate((e) => e.getBoundingClientRect().height))
      .toBeLessThan(50);
    await expect(
      page.getByRole("button", { name: "Menu", exact: true }),
    ).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const history = page.locator(
      ".ds-splat-context__top-actions-group--history",
    );
    if (width < 900) {
      await expect(history).toBeHidden();
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(
        page.getByRole("menuitem", { name: "Undo", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: "Redo", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(history).toBeVisible();
    }
    await expect
      .poll(async () => {
        const label = await activeTool.boundingBox();
        const menu = await page
          .getByRole("button", { name: "Menu", exact: true })
          .boundingBox();
        return (
          !!label &&
          !!menu &&
          label.x + label.width <= menu.x &&
          Math.abs(label.y + label.height / 2 - menu.y - menu.height / 2) < 2
        );
      })
      .toBe(true);
    await page.screenshot({ path: `/tmp/smalldraw-online-tool-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const portal = await context.newPage();
  portal.setDefaultTimeout(20_000);
  await portal.route("**/*.wasm", (route) =>
    route.fulfill({ status: 503, body: "temporarily unavailable" }),
  );
  await portal.goto(origin);
  await expect(portal.getByRole("status")).toContainText(
    "Could not load the drawing engine (503)",
  );
  await portal.unroute("**/*.wasm");
  await portal.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    portal.getByRole("heading", { name: "Your drawings" }),
  ).toBeVisible();
  console.log(
    "PASS: signed-in portal reports a failed WASM fetch and Try again recovers",
  );
  await portal.goto(`${origin}/account`);
  await portal
    .getByPlaceholder("Current password")
    .fill("Wasm-browser-test-password!");
  await portal
    .getByPlaceholder("New password", { exact: true })
    .fill("New-wasm-browser-test-password!");
  await portal
    .getByPlaceholder("Confirm new password")
    .fill("New-wasm-browser-test-password!");
  await portal
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(
    portal.getByText("Password changed.", { exact: true }),
  ).toBeVisible();
  console.log(
    "PASS: lazily loaded password cryptography also handles password changes",
  );
  await context.close();

  for (const failure of ["missing", "corrupt"] as const) {
    const isolated = await browser.newContext();
    const tab = await isolated.newPage();
    await tab.route("**/*.wasm", (route) =>
      route.fulfill({
        status: failure === "missing" ? 404 : 200,
        contentType: "application/wasm",
        body: "invalid wasm",
      }),
    );
    await tab.goto(`${origin}/draw/?new=1`);
    await expect(tab.locator("body")).toContainText(/Could not|Unable|failed/i);
    expect(await tab.evaluate(() => Boolean((window as any).kidsDrawApp))).toBe(
      false,
    );
    await tab.unroute("**/*.wasm");
    await tab.reload();
    await tab.waitForFunction(() => Boolean((window as any).kidsDrawApp));
    await isolated.close();
    console.log(`PASS: ${failure} WASM produces an error and reload recovers`);
  }
} finally {
  await browser?.close();
  preview?.stop(true);
  backend?.kill();
  if (backend) await backend.exited;
  await rm(temporary, { recursive: true, force: true });
}
