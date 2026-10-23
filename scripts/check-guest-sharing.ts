import { free, isImmutableString, load, stats } from "@automerge/automerge";
import { cbor } from "@automerge/automerge-repo";
import { type Browser, expect, type Page } from "@playwright/test";

/** Real guest uploads, response loss, retry, and shared/local navigation. */
export async function checkGuestSharing(
  browser: Browser,
  origin: string,
): Promise<{ joinUrl: string; thumbnail: string }> {
  const sender = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const receiver = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  sender.on("console", (message) => {
    if (/share flow|share command|failed to share/.test(message.text()))
      console.log("guest sender", message.text());
  });
  const ready = async (page: Page) => {
    await page.waitForFunction(() => Boolean((window as any).kidsDrawApp));
    await expect(page.locator(".kids-draw-frame")).toBeVisible();
    await page.waitForFunction(() => {
      const overlay = document.querySelector<HTMLElement>(".kids-draw-overlay");
      return overlay && overlay.style.pointerEvents !== "none";
    });
    await expect(page.locator(".kids-draw-startup-overlay")).not.toBeVisible();
  };
  const count = (page: Page) =>
    page.evaluate(
      () =>
        Object.keys((window as any).kidsDrawApp.store.getDocument().shapes)
          .length,
    );
  const draw = async (page: Page, lines: number, points: number) => {
    await page.evaluate(
      ({ lines, points }) => {
        const store = (window as any).kidsDrawApp.store;
        store.activateTool("brush.marker");
        let seed = 42;
        const random = () => {
          seed = (1664525 * seed + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        for (let line = 0; line < lines; line++) {
          store.dispatch("pointerDown", {
            point: [30, 30 + line * 10],
            buttons: 1,
          });
          store.dispatchBatch(
            "pointerMove",
            Array.from({ length: points }, () => ({
              point: [30 + random() * 200, 30 + random() * 200],
              buttons: 1,
            })),
          );
          store.dispatch("pointerUp", { point: [230, 230], buttons: 0 });
        }
      },
      { lines, points },
    );
  };
  try {
    await sender.goto(`${origin}/draw/?new=1`);
    await ready(sender);
    await draw(sender, 8, 2000);
    let previews = 0;
    const previewImages: string[] = [];
    await sender.route("**/api/v1/publishShareThumbnail*", async (route) => {
      const input = JSON.parse(route.request().postData()!)["0"];
      expect(["image/png", "image/webp"]).toContain(input.contentType);
      expect(
        input.content.startsWith(
          input.contentType === "image/png" ? "iVBORw0KGgo" : "UklGR",
        ),
      ).toBe(true);
      previews++;
      previewImages.push(input.content);
      await route.continue();
    });
    let uploadBytes = 0;
    let dropped = false;
    const uploadIds: string[] = [];
    const uploadSizes: number[] = [];
    await sender.route(
      "**/api/v1/documents/registerCollaborativeDocument",
      async (route) => {
        const body = route.request().postDataBuffer()!;
        uploadBytes = Math.max(uploadBytes, body.length);
        const input = cbor.decode(body) as {
          content: Uint8Array;
          documentId: string;
        };
        const uploaded = load<{
          shapes: Record<
            string,
            { geometry: { type: string; pointsJson?: unknown } }
          >;
        }>(input.content);
        try {
          for (const shape of Object.values(uploaded.shapes)) {
            if (shape.geometry.type === "pen-json")
              expect(isImmutableString(shape.geometry.pointsJson)).toBe(true);
          }
          // Thousands of points must not become hundreds of thousands of text operations.
          expect(stats(uploaded).numOps).toBeLessThan(10000);
        } finally {
          free(uploaded);
        }
        uploadIds.push(input.documentId);
        uploadSizes.push(body.length);
        console.log("Guest request bytes", body.length);
        await expect(
          sender.getByRole("progressbar", { name: "Sharing drawing…" }),
        ).toBeVisible();
        if (!dropped) {
          await sender.screenshot({ path: "/tmp/sharing-progress-mobile.png" });
          await sender.setViewportSize({ width: 1440, height: 900 });
          await sender.screenshot({
            path: "/tmp/sharing-progress-desktop.png",
          });
          await sender.setViewportSize({ width: 390, height: 844 });
        }
        const response = await route.fetch();
        console.log("Guest response", response.status());
        expect(response.ok()).toBe(true);
        if (!dropped) {
          dropped = true;
          await route.abort("failed");
        } else await route.fulfill({ response });
      },
    );
    await sender.evaluate(() => (window as any).kidsDrawApp.commands.share());
    await expect(
      sender.getByText("Unable to share drawing", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await sender.getByRole("button", { name: "OK", exact: true }).click();
    await ready(sender);
    expect(await count(sender)).toBe(8);
    // Edits after a failed share must be included when retrying the same registration.
    await draw(sender, 1, 12);
    await sender.evaluate(() => (window as any).kidsDrawApp.commands.share());
    const link = sender.getByLabel("Share URL");
    await expect(link).toBeVisible({ timeout: 20000 });
    const join = await link.inputValue();
    expect(new URL(join).pathname).toMatch(/^\/draw\/shared\/[^/]+$/);
    expect(new URL(join).search).toBe("");
    expect(previews).toBeGreaterThanOrEqual(1);
    expect(uploadIds).toHaveLength(2);
    expect(uploadIds[0]).toBe(uploadIds[1]);
    expect(uploadSizes[1]).toBeLessThan(uploadSizes[0] * 1.1);
    expect(uploadBytes).toBeGreaterThan(100 * 1024);
    await sender.getByRole("button", { name: "Done", exact: true }).click();
    await receiver.goto(`${origin}/draw/?new=1`);
    await ready(receiver);
    await draw(receiver, 1, 12);
    const local = await receiver.evaluate(() =>
      (window as any).kidsDrawApp.core.getCurrentDocUrl(),
    );
    await receiver.waitForTimeout(750);
    console.log("Guest upload bytes", uploadBytes);
    await receiver.goto(join);
    await ready(receiver);
    expect(await count(receiver)).toBe(9);
    await receiver.waitForURL(/\/draw\/[A-Za-z0-9_-]{20,}$/);
    const cleanJoinedUrl = receiver.url();
    const oldJoin = `${origin}/draw/?join=${encodeURIComponent(new URL(join).pathname.split("/").at(-1)!)}`;
    const oldReceiver = await browser.newPage();
    try {
      await oldReceiver.goto(oldJoin);
      await ready(oldReceiver);
      await expect(oldReceiver).toHaveURL(cleanJoinedUrl);
      expect(await count(oldReceiver)).toBe(9);
    } finally {
      await oldReceiver.close();
    }
    const shared = await receiver.evaluate(
      () =>
        `catalog-collab:${(window as any).kidsDrawApp.core.getCurrentDocUrl().replace("automerge:", "")}`,
    );
    for (let i = 0; i < 10; i++) {
      const target = i % 2 ? shared : local;
      console.log("Guest switch", i, target === local ? "local" : "shared");
      await receiver.evaluate(async (target) => {
        (window as any).__smalldrawStartupLog.length = 0;
        await (window as any).kidsDrawApp.commands.openDocument(target);
      }, target);
      await ready(receiver);
      expect(await count(receiver)).toBe(i % 2 ? 9 : 1);
      await receiver.waitForTimeout(100);
      expect(
        await receiver.evaluate(
          () =>
            (window as any).__smalldrawStartupLog.filter(
              (entry: any) => entry.metadata?.reason === "switch_document",
            ).length,
        ),
      ).toBe(1);
    }
    await receiver.reload();
    await ready(receiver);
    await expect.poll(() => count(receiver)).toBe(9);
    await receiver.evaluate(async (target) => {
      await (window as any).kidsDrawApp.commands.openDocument(target);
    }, local);
    await ready(receiver);
    await receiver.reload();
    await ready(receiver);
    expect(await count(receiver)).toBe(1);
    const previousPreview = previewImages.at(-1);
    const updatedPreviewResponse = sender.waitForResponse((response) =>
      response.url().includes("/publishShareThumbnail"),
    );
    await sender.evaluate(() =>
      (window as any).kidsDrawApp.store.updateSharedSettings({
        strokeColor: "#ff0000",
      }),
    );
    await draw(sender, 1, 12);
    await expect
      .poll(() => previewImages.at(-1), { timeout: 10000 })
      .not.toBe(previousPreview);
    await updatedPreviewResponse;
    console.log(
      "PASS: shared drawing edits automatically upload the updated picker thumbnail",
    );
    console.log(
      `PASS: mobile guest sharing (${uploadBytes} upload bytes), lost-response retry with new edits, and 10 shared/local switches survive reload`,
    );
    return { joinUrl: join, thumbnail: previewImages.at(-1)! };
  } catch (error) {
    await sender.screenshot({ path: "/tmp/guest-share-failure.png" });
    console.log("Guest failure UI", await receiver.locator("body").innerText());
    throw error;
  } finally {
    await sender.close();
    await receiver.close();
  }
}
