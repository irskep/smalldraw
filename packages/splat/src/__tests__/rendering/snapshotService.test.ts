import { afterEach, expect, spyOn, test } from "bun:test";
import { type DrawingDocument, DrawingStore } from "@smalldraw/core";
import { createCanvas } from "canvas";
import { SnapshotService } from "../../controller/createSnapshotService";
import {
  getLoadedRasterImage,
  registerRasterImage,
  resetRasterImageCache,
} from "../../shapes/rasterImageCache";

const originalImage = globalThis.Image;
afterEach(() => {
  globalThis.Image = originalImage;
  resetRasterImageCache();
});

function fixture() {
  const store = new DrawingStore({ tools: [] });
  let current = {
    ...store.getDocument(),
    size: { width: 20, height: 20 },
    layers: {
      reference: {
        id: "reference",
        kind: "image",
        zIndex: "a0",
        image: { src: "pending" },
      },
    },
  } as DrawingDocument;
  spyOn(store, "getDocument").mockImplementation(() => current);
  const service = new SnapshotService({
    store,
    shapeRendererRegistry: new Map(),
    backgroundColor: "white",
  });
  return {
    service,
    switchDocument() {
      current = { ...current, layers: {} } as DrawingDocument;
    },
  };
}

test("export waits for reference pixels and preserves the original document across a switch", async () => {
  globalThis.Image = class {
    complete = false;
    naturalWidth = 0;
    naturalHeight = 0;
    onload = null;
    onerror = null;
    src = "";
  } as unknown as typeof Image;
  const f = fixture();
  const image = createCanvas(20, 20);
  image.getContext("2d").fillStyle = "red";
  image.getContext("2d").fillRect(0, 0, 20, 20);
  const createElement = spyOn(document, "createElement").mockImplementation(
    (() => createCanvas(1, 1)) as never,
  );
  try {
    const result = f.service.createPngExport({ width: 40, height: 40 });
    f.switchDocument();
    registerRasterImage("pending", image as unknown as HTMLCanvasElement);
    // The export must retain its image while unrelated documents warm assets.
    for (let i = 0; i < 40; i++)
      registerRasterImage(`pressure-${i}`, {
        width: 1024,
        height: 1024,
      } as HTMLCanvasElement);
    const exported = await result;
    expect(exported.dataUrl).toContain("data:image/png");
    const output = createElement.mock.results[0].value as ReturnType<
      typeof createCanvas
    >;
    expect([
      ...output.getContext("2d").getImageData(30, 30, 1, 1).data,
    ]).toEqual([255, 0, 0, 255]);
    globalThis.Image = undefined as unknown as typeof Image;
    expect(getLoadedRasterImage("pending")).toBeNull();
  } finally {
    createElement.mockRestore();
  }
});

test("failed image loading rejects export and skips thumbnail replacement", async () => {
  const f = fixture();
  let fail: (() => void) | undefined;
  globalThis.Image = class {
    complete = false;
    naturalWidth = 0;
    naturalHeight = 0;
    onload = null;
    onerror: (() => void) | null = null;
    set src(_: string) {
      fail = () => this.onerror?.();
    }
  } as unknown as typeof Image;
  const exported = f.service.createPngExport({ width: 20, height: 20 });
  expect(await f.service.createThumbnailBlob()).toBeNull();
  fail!();
  await expect(exported).rejects.toThrow("Some images could not load");
  expect(await f.service.createThumbnailBlob()).toBeNull();
});
