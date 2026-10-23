import { Database } from "bun:sqlite";

import { expect, type Browser } from "@playwright/test";

/** Real production bundles, authenticated admin session, guest share and live takedown. */
export async function checkAdminModeration(
  browser: Browser,
  origin: string,
  databasePath: string,
  automergeDatabasePath: string,
) {
  const db = new Database(databasePath);
  const suffix = crypto.randomUUID();
  const adminId = `moderator-${suffix}`;
  const session = crypto.randomUUID();
  db.query(
    "INSERT INTO users(id,username,registration_record,is_server_admin) VALUES(?,?,?,1)",
  ).run(adminId, adminId, "test-only-session");
  db.query("INSERT INTO sessions(session_key,user_id) VALUES(?,?)").run(
    session,
    adminId,
  );
  const guest = await browser.newContext();
  const admin = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await admin.addCookies([
    { name: "smalldraw_session", value: session, url: origin },
  ]);
  await guest.addInitScript(() => {
    (window as any).moderationSocketCloses = [];
    const Original = window.WebSocket;
    window.WebSocket = class extends Original {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener("close", (event) =>
          (window as any).moderationSocketCloses.push({
            code: event.code,
            reason: event.reason,
          }),
        );
      }
    };
  });
  const drawing = await guest.newPage();
  const page = await admin.newPage();
  page.setDefaultTimeout(20_000);
  drawing.setDefaultTimeout(20_000);
  drawing.on("pageerror", (error) =>
    console.log("Drawing error:", error.message),
  );
  try {
    await drawing.goto(`${origin}/draw/new`);
    await drawing.waitForFunction(() => Boolean((window as any).kidsDrawApp));
    await expect(drawing.locator(".kids-draw-frame")).toBeVisible();
    await expect(
      drawing.locator(".kids-draw-startup-overlay"),
    ).not.toBeVisible();
    const box = (await drawing.locator(".kids-draw-frame").boundingBox())!;
    await drawing.mouse.move(box.x + 50, box.y + 50);
    await drawing.mouse.down();
    await drawing.mouse.move(box.x + 180, box.y + 120, { steps: 15 });
    await drawing.mouse.up();
    await drawing.evaluate(() => (window as any).kidsDrawApp.commands.share());
    const share = drawing.getByLabel("Share URL");
    await expect(share).toBeVisible();
    const joinUrl = await share.inputValue();
    const token = new URL(joinUrl).pathname.split("/").at(-1)!;
    const row = db
      .query("SELECT document_id FROM document_invitations WHERE token=?")
      .get(token) as { document_id: string };
    const id = row.document_id;
    // Close the share dialog, leaving the collaborator connected.
    await drawing
      .getByRole("button", { name: "Done", exact: true })
      .last()
      .click();
    await page.goto(`${origin}/admin`);
    await expect(
      page.getByRole("heading", { name: "Recently updated drawings" }),
    ).toBeVisible();
    await expect(page.locator(`a[href='/admin/drawings/${id}']`)).toBeVisible();
    await page.screenshot({
      path: `/tmp/moderation-real-feed-${browser.browserType().name()}.png`,
    });
    await page.locator(`a[href='/admin/drawings/${id}']`).click();
    await expect(
      page.getByRole("button", { name: "Load drawing", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Load drawing", exact: true })
      .click();
    await expect(page.locator(".moderation-image--detail img")).toBeVisible();
    const pixels = await page
      .locator(".moderation-image--detail img")
      .evaluate(async (image) => {
        const img = image as HTMLImageElement;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let dark = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i] < 128 && data[i + 3] > 0) dark++;
        return dark;
      });
    expect(pixels).toBeGreaterThan(20);
    expect(
      db
        .query(
          "SELECT count(*) AS n FROM users_on_documents WHERE document_id=?",
        )
        .get(id),
    ).toEqual({ n: 0 });
    expect(
      db
        .query(
          "SELECT count(*) AS n FROM document_invitations WHERE document_id=? AND scope='share'",
        )
        .get(id),
    ).toEqual({ n: 1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `/tmp/moderation-real-detail-${browser.browserType().name()}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Take down drawing", exact: true })
      .click();
    await page
      .getByLabel("Reason", { exact: true })
      .fill("Disposable moderation acceptance test");
    await page
      .getByRole("button", { name: "Confirm takedown", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Taken down", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".moderation-image--detail img")).toHaveCount(0);
    await drawing.waitForTimeout(1000);
    console.log(
      "Takedown browser state",
      await drawing.evaluate(() => ({
        url: (window as any).kidsDrawApp?.core.getCurrentDocUrl(),
        closes: (window as any).moderationSocketCloses,
        text: document.body.innerText.slice(-1000),
      })),
    );
    await drawing.screenshot({ path: "/tmp/moderation-active-editor.png" });
    await expect(
      drawing.getByText("This drawing is unavailable.", { exact: true }),
    ).toBeVisible();
    await expect(drawing.locator(".kids-draw-frame")).not.toBeVisible();
    const fresh = await guest.newPage();
    await fresh.goto(joinUrl);
    await expect(
      fresh
        .getByText(/unavailable|no longer available|could not open/i)
        .first(),
    ).toBeVisible();
    const response = await guest.request.get(
      `${origin}/api/v1/adminDrawingDetails?input=${encodeURIComponent(JSON.stringify({ documentId: id }))}`,
    );
    expect(response.status()).toBe(401);
    expect(
      db
        .query(
          "SELECT cleanup_state FROM document_moderation WHERE document_id=?",
        )
        .get(id),
    ).toEqual({ cleanup_state: "complete" });
    const storage = new Database(automergeDatabasePath, { readonly: true });
    try {
      expect(
        storage
          .query(
            "SELECT count(*) AS n FROM automerge_data WHERE key >= ? AND key < ?",
          )
          .get(`${id}/`, `${id}0`),
      ).toEqual({ n: 0 });
    } finally {
      storage.close();
    }
    await drawing.reload();
    await expect(
      drawing
        .getByText(/unavailable|no longer available|could not open/i)
        .first(),
    ).toBeVisible();
    const closes = await drawing.evaluate(
      () => (window as any).moderationSocketCloses.length,
    );
    await drawing.waitForTimeout(6000);
    expect(
      await drawing.evaluate(
        () => (window as any).moderationSocketCloses.length,
      ),
    ).toBe(closes);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Taken down", exact: true }),
    ).toBeVisible();
    // An account drawing also needs terminal checkpoint handling without guest sharing.
    const accountEditor = await admin.newPage();
    let checkpoints = 0;
    accountEditor.on("request", (request) => {
      if (request.url().includes("checkpointAccountDrawing")) checkpoints++;
    });
    await accountEditor.goto(`${origin}/draw/new`);
    await accountEditor.waitForFunction(() =>
      Boolean((window as any).kidsDrawApp),
    );
    await expect(
      accountEditor.locator(".kids-draw-startup-overlay"),
    ).not.toBeVisible();
    const addMark = () =>
      accountEditor.evaluate(() => {
        const store = (window as any).kidsDrawApp.store;
        store.dispatch("pointerDown", { point: [40, 40], buttons: 1 });
        store.dispatch("pointerMove", { point: [100, 100], buttons: 1 });
        store.dispatch("pointerUp", { point: [100, 100], buttons: 0 });
      });
    await addMark();
    const accountId = await accountEditor.evaluate(() =>
      (window as any).kidsDrawApp.core
        .getCurrentDocUrl()
        .replace(/^automerge:/, ""),
    );
    await expect
      .poll(
        () =>
          db
            .query(
              "SELECT count(*) AS n FROM users_on_documents WHERE document_id=? AND user_id=?",
            )
            .get(accountId, adminId),
        { timeout: 20_000 },
      )
      .toEqual({ n: 1 });
    await page.goto(`${origin}/admin/drawings/${accountId}`);
    await page
      .getByRole("button", { name: "Take down drawing", exact: true })
      .click();
    await page
      .getByLabel("Reason", { exact: true })
      .fill("Disposable account moderation test");
    await page
      .getByRole("button", { name: "Confirm takedown", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Taken down", exact: true }),
    ).toBeVisible();
    await addMark();
    await expect(
      accountEditor.getByText("This drawing is unavailable.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    const countAfterBlock = checkpoints;
    await accountEditor.waitForTimeout(6500);
    expect(checkpoints).toBe(countAfterBlock);
    console.log(
      `PASS ${browser.browserType().name()}: real guest share, read-only admin render, mobile takedown, active editor blocked, reload and anonymous denial`,
    );
  } finally {
    await admin.close();
    await guest.close();
    db.close();
  }
}
