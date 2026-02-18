import { afterEach, describe, expect, test } from "bun:test";
import {
  getLoadedImageStampAsset,
  warmImageStampAssets,
} from "../../tools/stamps/imageStampAssets";

const originalImage = globalThis.Image;

afterEach(() => {
  globalThis.Image = originalImage;
});

describe("image stamp assets", () => {
  test("does not return broken images", () => {
    class FakeImage {
      complete = false;
      naturalWidth = 0;
      naturalHeight = 0;
      decoding = "";
      onerror: ((this: GlobalEventHandlers, ev: Event) => any) | null = null;

      set src(value: string) {
        if (value.includes("broken")) {
          this.complete = true;
          this.naturalWidth = 0;
          this.naturalHeight = 0;
          this.onerror?.call(
            this as unknown as GlobalEventHandlers,
            new Event("error"),
          );
          return;
        }
        this.complete = true;
        this.naturalWidth = 16;
        this.naturalHeight = 16;
      }
    }

    globalThis.Image = FakeImage as unknown as typeof Image;

    const first = getLoadedImageStampAsset("broken://stamp-a");
    expect(first).toBeNull();

    const second = getLoadedImageStampAsset("broken://stamp-a");
    expect(second).toBeNull();
  });

  test("warms image assets on demand", () => {
    class FakeImage {
      complete = false;
      naturalWidth = 0;
      naturalHeight = 0;
      decoding = "";
      onerror: ((this: GlobalEventHandlers, ev: Event) => any) | null = null;

      set src(_value: string) {
        this.complete = true;
        this.naturalWidth = 32;
        this.naturalHeight = 24;
      }
    }

    globalThis.Image = FakeImage as unknown as typeof Image;

    warmImageStampAssets(["ok://stamp-1", "ok://stamp-2"]);

    expect(getLoadedImageStampAsset("ok://stamp-1")).not.toBeNull();
    expect(getLoadedImageStampAsset("ok://stamp-2")).not.toBeNull();
  });
});
