// Generate deterministic synthetic drawings through the real tool pipeline; no sharing/uploads.
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
try {
  for (const [name, lines, points] of [
    ["small", 4, 100],
    ["medium", 8, 2000],
    ["large", 32, 2000],
  ] as const) {
    const page = await browser.newPage();
    await page.goto(
      `${process.env.BENCH_ORIGIN ?? "http://localhost:3001"}/?new=1`,
    );
    await page.waitForFunction(
      () =>
        !!(window as any).kidsDrawApp &&
        document.querySelector<HTMLElement>(".kids-draw-overlay")?.style
          .pointerEvents !== "none",
    );
    const bytes = await page.evaluate(
      ({ lines, points }) => {
        const app = (window as any).kidsDrawApp;
        const store = app.store;
        store.activateTool("brush.marker");
        let seed = 42;
        const random = () => {
          seed = (1664525 * seed + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        for (let i = 0; i < lines; i++) {
          store.dispatch("pointerDown", {
            point: [30, 30 + i * 10],
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
        return Array.from(app.core.createDocumentCopy().binary) as number[];
      },
      { lines, points },
    );
    await Bun.write(`/tmp/smalldraw-${name}.automerge`, new Uint8Array(bytes));
    console.log(name, bytes.length);
    await page.close();
  }
} finally {
  await browser.close();
}
