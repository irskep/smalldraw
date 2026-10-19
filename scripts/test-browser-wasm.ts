/** Exercise the actual Vite/Bun production output against an isolated server. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import * as opaque from "@serenity-kit/opaque";

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
